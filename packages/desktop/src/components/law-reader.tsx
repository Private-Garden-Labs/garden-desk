import type { LawAct } from "@gardendesk/shared";
import { type CSSProperties, Fragment, useEffect, useRef, useState } from "react";
import type { DesktopApi } from "../api.js";
import { t } from "../i18n/index.js";
import type { LawTarget } from "../law-citations.js";
import { closeLaw } from "../side-panel.js";
import { DrawerResizeHandle, useDrawerResize } from "./drawer-resize.js";
import { Icon } from "./icons.js";

const WIDTH_KEY = "gardendesk.law-reader-width";

type Loaded = { act: LawAct } | { failed: true };
type LoadedAct = Loaded & { key: string };

function sectionHeading(citation: string, heading: string) {
  const path = heading.replace(/\s*\(also: [^)]*\)$/u, "").split(" › ");
  return {
    group: path.slice(0, -1).join(" › "),
    label: citation.split(", ").at(-1) ?? citation,
    title: path.at(-1) ?? "",
  };
}

// biome-ignore-start lint/a11y/noNoninteractiveTabindex: The long law text needs a keyboard scroll target.
function LawSections({ act, target }: { act: LawAct; target: LawTarget }) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const index = act.sections.findIndex((section) => section.citation === target.citation);
    body.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "start" });
  }, [act, target]);
  let group = "";
  return (
    <div className="law-reader-body" ref={body} tabIndex={0}>
      {act.sections.map((section, index) => {
        const heading = sectionHeading(section.citation, section.heading);
        const newGroup = heading.group !== "" && heading.group !== group;
        group = heading.group;
        const targeted = section.citation === target.citation;
        return (
          <Fragment key={section.citation}>
            {newGroup ? <h3 className="law-reader-group">{heading.group}</h3> : null}
            <article
              className={`law-reader-section${targeted ? " law-reader-target" : ""}`}
              data-index={index}
            >
              <h4>
                <span>{heading.label}</span> {heading.title}
              </h4>
              <p>{section.text}</p>
            </article>
          </Fragment>
        );
      })}
    </div>
  );
}
// biome-ignore-end lint/a11y/noNoninteractiveTabindex: The long law text needs a keyboard scroll target.

function LawReaderHeader({ api, loaded, target }: LawReaderProps & { loaded: Loaded | undefined }) {
  const [sourceFailed, setSourceFailed] = useState(false);
  const act = loaded !== undefined && "act" in loaded ? loaded.act : undefined;
  const openSource = () =>
    api.openLawSource(target.jurisdiction, target.source).catch(() => setSourceFailed(true));
  return (
    <header className="law-reader-header">
      <div>
        <h2>{act?.title ?? t(loaded === undefined ? "lawReader.loading" : "lawReader.error")}</h2>
        {act === undefined ? null : (
          <p>
            {act.version} ·{" "}
            <button className="law-reader-source" onClick={openSource} type="button">
              {t("lawReader.source", { host: act.url.split("/")[2] ?? act.url })}
              <Icon name="external" />
            </button>
          </p>
        )}
        {sourceFailed ? <p role="alert">{t("lawReader.sourceError")}</p> : null}
      </div>
      <button aria-label={t("lawReader.close")} onClick={closeLaw} type="button">
        <Icon name="close" />
      </button>
    </header>
  );
}

interface LawReaderProps {
  api: DesktopApi;
  target: LawTarget;
}

function OpenLawReader({ api, target }: LawReaderProps) {
  const resize = useDrawerResize(WIDTH_KEY);
  const [loaded, setLoaded] = useState<LoadedAct>();
  const { jurisdiction, source } = target;
  const key = `${jurisdiction}/${source}`;
  useEffect(() => {
    let current = true;
    const settle = (result: Loaded) => {
      if (current) setLoaded({ ...result, key: `${jurisdiction}/${source}` });
    };
    api.readLaw(jurisdiction, source).then(
      (act) => settle({ act }),
      () => settle({ failed: true }),
    );
    return () => {
      current = false;
    };
  }, [api, jurisdiction, source]);
  const shown = loaded?.key === key ? loaded : undefined;
  const style =
    resize.width === undefined
      ? undefined
      : ({ "--law-reader-width": `${resize.width}px` } as CSSProperties);
  return (
    <aside aria-label={t("lawReader.label")} className="law-reader" style={style}>
      <DrawerResizeHandle label={t("lawReader.resize")} resize={resize} />
      <LawReaderHeader api={api} key={key} loaded={shown} target={target} />
      {shown !== undefined && "act" in shown ? (
        <LawSections act={shown.act} key={key} target={target} />
      ) : null}
    </aside>
  );
}

export function LawReader({ api, target }: { api: DesktopApi; target: LawTarget | undefined }) {
  return target === undefined ? null : <OpenLawReader api={api} target={target} />;
}
