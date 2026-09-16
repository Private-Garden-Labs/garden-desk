use std::error::Error;
use std::ffi::c_void;
use std::io::{Read, Write};
use std::mem::{MaybeUninit, size_of};
use std::thread::sleep;
use std::time::Duration;

const AF_HYPERV: i32 = 34;
const SOCK_STREAM: i32 = 1;
const HV_PROTOCOL_RAW: i32 = 1;
const INVALID_SOCKET: usize = usize::MAX;
const REQUEST: &[u8] = b"{\"jobId\":\"00000000-0000-4000-8000-000000000001\",\"operation\":\"probe\",\"protocolVersion\":1,\"requestId\":\"m1-probe\"}";
const MAX_AGENT_FRAME_BYTES: usize = 192 * 1024 * 1024;

#[repr(C)]
#[derive(Clone, Copy)]
struct Guid {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

#[repr(C)]
struct HyperVSocketAddress {
    family: u16,
    reserved: u16,
    vm_id: Guid,
    service_id: Guid,
}

#[link(name = "ws2_32")]
unsafe extern "system" {
    fn WSAStartup(version: u16, data: *mut c_void) -> i32;
    fn WSACleanup() -> i32;
    fn WSAGetLastError() -> i32;
    fn socket(address_family: i32, socket_type: i32, protocol: i32) -> usize;
    fn connect(socket: usize, address: *const HyperVSocketAddress, length: i32) -> i32;
    fn send(socket: usize, buffer: *const u8, length: i32, flags: i32) -> i32;
    fn recv(socket: usize, buffer: *mut u8, length: i32, flags: i32) -> i32;
    fn shutdown(socket: usize, how: i32) -> i32;
    fn closesocket(socket: usize) -> i32;
}

fn parse_guid(value: &str) -> Result<Guid, Box<dyn Error>> {
    let compact = value.replace('-', "");
    if compact.len() != 32 {
        return Err("RuntimeId was not a GUID.".into());
    }
    let bytes = (0..16)
        .map(|index| u8::from_str_radix(&compact[index * 2..index * 2 + 2], 16))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Guid {
        data1: u32::from_be_bytes(bytes[0..4].try_into()?),
        data2: u16::from_be_bytes(bytes[4..6].try_into()?),
        data3: u16::from_be_bytes(bytes[6..8].try_into()?),
        data4: bytes[8..16].try_into()?,
    })
}

fn service_id() -> Guid {
    Guid {
        data1: 4050,
        data2: 0xfacb,
        data3: 0x11e6,
        data4: [0xbd, 0x58, 0x64, 0x00, 0x6a, 0x79, 0x86, 0xd3],
    }
}

struct Winsock;

impl Winsock {
    fn start() -> Result<Self, Box<dyn Error>> {
        let mut data = MaybeUninit::<[u8; 512]>::zeroed();
        let status = unsafe { WSAStartup(0x0202, data.as_mut_ptr().cast()) };
        if status != 0 {
            return Err(format!("WSAStartup failed: {status}").into());
        }
        Ok(Self)
    }
}

impl Drop for Winsock {
    fn drop(&mut self) {
        unsafe { WSACleanup() };
    }
}

struct Socket(usize);

impl Socket {
    fn connect(runtime_id: &str) -> Result<Self, Box<dyn Error>> {
        let address = HyperVSocketAddress {
            family: AF_HYPERV as u16,
            reserved: 0,
            vm_id: parse_guid(runtime_id)?,
            service_id: service_id(),
        };
        let mut last_error = 0;
        for _ in 0..80 {
            let handle = unsafe { socket(AF_HYPERV, SOCK_STREAM, HV_PROTOCOL_RAW) };
            if handle == INVALID_SOCKET {
                return Err(format!("Hyper-V socket creation failed: {}", unsafe {
                    WSAGetLastError()
                })
                .into());
            }
            if unsafe { connect(handle, &address, size_of::<HyperVSocketAddress>() as i32) } == 0 {
                return Ok(Self(handle));
            }
            last_error = unsafe { WSAGetLastError() };
            unsafe { closesocket(handle) };
            sleep(Duration::from_millis(250));
        }
        Err(format!("Hyper-V socket connection failed: {last_error}").into())
    }

    fn write_all(&self, bytes: &[u8]) -> Result<(), Box<dyn Error>> {
        write_socket(self.0, bytes)
    }

    fn read_exact(&self, bytes: &mut [u8]) -> Result<(), Box<dyn Error>> {
        let mut offset = 0;
        while offset < bytes.len() {
            let received = unsafe {
                recv(
                    self.0,
                    bytes[offset..].as_mut_ptr(),
                    (bytes.len() - offset) as i32,
                    0,
                )
            };
            if received <= 0 {
                return Err(format!("Hyper-V socket read failed: {}", unsafe {
                    WSAGetLastError()
                })
                .into());
            }
            offset += received as usize;
        }
        Ok(())
    }
}

fn input(handle: usize) -> Result<(), Box<dyn Error>> {
    let stdin = std::io::stdin();
    let mut input = stdin.lock();
    loop {
        let mut header = [0; 4];
        let first = input.read(&mut header)?;
        if first == 0 {
            return Ok(());
        }
        input.read_exact(&mut header[first..])?;
        let length = u32::from_be_bytes(header) as usize;
        if length == 0 || length > MAX_AGENT_FRAME_BYTES {
            return Err("Host sent an invalid agent frame length.".into());
        }
        let mut payload = vec![0; length];
        input.read_exact(&mut payload)?;
        write_socket(handle, &header)?;
        write_socket(handle, &payload)?;
    }
}

fn write_socket(handle: usize, bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    let mut offset = 0;
    while offset < bytes.len() {
        let written = unsafe {
            send(
                handle,
                bytes[offset..].as_ptr(),
                (bytes.len() - offset) as i32,
                0,
            )
        };
        if written <= 0 {
            return Err(format!("Hyper-V socket write failed: {}", unsafe {
                WSAGetLastError()
            })
            .into());
        }
        offset += written as usize;
    }
    Ok(())
}

fn read_socket(handle: usize, bytes: &mut [u8]) -> Result<bool, Box<dyn Error>> {
    let mut offset = 0;
    while offset < bytes.len() {
        let received = unsafe {
            recv(
                handle,
                bytes[offset..].as_mut_ptr(),
                (bytes.len() - offset) as i32,
                0,
            )
        };
        if received == 0 && offset == 0 {
            return Ok(false);
        }
        if received <= 0 {
            return Err(format!("Hyper-V socket read failed: {}", unsafe {
                WSAGetLastError()
            })
            .into());
        }
        offset += received as usize;
    }
    Ok(true)
}

impl Drop for Socket {
    fn drop(&mut self) {
        unsafe { closesocket(self.0) };
    }
}

fn valid_guest_result(result: &str) -> bool {
    result.starts_with("{\"nonLoopbackNetworkDeviceCount\":0,\"probes\":{")
        && result.ends_with(
            "},\"protocolVersion\":1,\"requestId\":\"m1-probe\",\"status\":\"ok\",\"transport\":\"vsock\"}",
        )
        && [
            "\"dnsBlocked\":true",
            "\"hostBlocked\":true",
            "\"ipv4Blocked\":true",
            "\"ipv6Blocked\":true",
            "\"lanBlocked\":true",
            "\"multicastBlocked\":true",
        ]
        .iter()
        .all(|probe| result.contains(probe))
}

pub fn exchange(runtime_id: &str) -> Result<String, Box<dyn Error>> {
    let _winsock = Winsock::start()?;
    let connection = Socket::connect(runtime_id)?;
    connection.write_all(&(REQUEST.len() as u32).to_be_bytes())?;
    connection.write_all(REQUEST)?;
    let mut header = [0; 4];
    connection.read_exact(&mut header)?;
    let length = u32::from_be_bytes(header) as usize;
    if length == 0 || length > 4096 {
        return Err("Guest returned an invalid frame length.".into());
    }
    let mut payload = vec![0; length];
    connection.read_exact(&mut payload)?;
    let result = String::from_utf8(payload)?;
    if !valid_guest_result(&result) {
        return Err("Guest returned invalid M1 evidence.".into());
    }
    Ok(result)
}

pub fn relay(runtime_id: &str) -> Result<(), Box<dyn Error>> {
    let _winsock = Winsock::start()?;
    let connection = Socket::connect(runtime_id)?;
    let handle = connection.0;
    let (input_result_tx, input_result_rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = input(handle).map_err(|error| error.to_string());
        let failed = result.is_err();
        let _ = input_result_tx.send(result);
        unsafe { shutdown(handle, if failed { 2 } else { 1 }) };
    });
    let stdout = std::io::stdout();
    let mut output = stdout.lock();
    loop {
        let mut header = [0; 4];
        if !read_socket(handle, &mut header)? {
            return match input_result_rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(())) => Ok(()),
                Ok(Err(error)) => Err(error.into()),
                Err(_) => Err("The guest closed the agent connection.".into()),
            };
        }
        let length = u32::from_be_bytes(header) as usize;
        if length == 0 || length > MAX_AGENT_FRAME_BYTES {
            return Err("Guest returned an invalid agent frame length.".into());
        }
        let mut payload = vec![0; length];
        if !read_socket(handle, &mut payload)? {
            return Err("Guest closed an incomplete agent frame.".into());
        }
        output.write_all(&header)?;
        output.write_all(&payload)?;
        output.flush()?;
    }
}
