use std::io::{Read, Write};
#[cfg(unix)]
use std::time::Duration;
#[cfg(windows)]
use std::time::{Duration, Instant};

#[cfg(unix)]
fn connect(endpoint: &str) -> std::io::Result<std::os::unix::net::UnixStream> {
    std::os::unix::net::UnixStream::connect(endpoint)
}

#[cfg(windows)]
fn transient_pipe_open_error(error: &std::io::Error) -> bool {
    matches!(error.raw_os_error(), Some(2 | 231))
}

#[cfg(windows)]
fn connect(endpoint: &str) -> std::io::Result<std::fs::File> {
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(endpoint)
        {
            Ok(stream) => return Ok(stream),
            Err(error) if transient_pipe_open_error(&error) && Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(error) => return Err(error),
        }
    }
}

pub(crate) fn exchange(endpoint: &str, request: &str) -> Result<Vec<u8>, String> {
    const MAX_RESPONSE_BYTES: u64 = 192 * 1024 * 1024;
    let mut stream = connect(endpoint).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .map_err(|error| error.to_string())?;
        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(|error| error.to_string())?;
    }
    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;
    let mut response = Vec::new();
    stream
        .take(MAX_RESPONSE_BYTES + 1)
        .read_to_end(&mut response)
        .map_err(|error| error.to_string())?;
    if response.len() as u64 > MAX_RESPONSE_BYTES {
        return Err("Garden Desk Core response exceeded its limit.".to_owned());
    }
    Ok(response)
}
