import flagBd from "flag-icons/flags/4x3/bd.svg?no-inline";
import flagBr from "flag-icons/flags/4x3/br.svg?no-inline";
import flagCn from "flag-icons/flags/4x3/cn.svg?no-inline";
import flagCz from "flag-icons/flags/4x3/cz.svg?no-inline";
import flagDe from "flag-icons/flags/4x3/de.svg?no-inline";
import flagDk from "flag-icons/flags/4x3/dk.svg?no-inline";
import flagEs from "flag-icons/flags/4x3/es.svg?no-inline";
import flagFi from "flag-icons/flags/4x3/fi.svg?no-inline";
import flagFr from "flag-icons/flags/4x3/fr.svg?no-inline";
import flagId from "flag-icons/flags/4x3/id.svg?no-inline";
import flagIl from "flag-icons/flags/4x3/il.svg?no-inline";
import flagIn from "flag-icons/flags/4x3/in.svg?no-inline";
import flagIr from "flag-icons/flags/4x3/ir.svg?no-inline";
import flagIt from "flag-icons/flags/4x3/it.svg?no-inline";
import flagJp from "flag-icons/flags/4x3/jp.svg?no-inline";
import flagKr from "flag-icons/flags/4x3/kr.svg?no-inline";
import flagMy from "flag-icons/flags/4x3/my.svg?no-inline";
import flagNl from "flag-icons/flags/4x3/nl.svg?no-inline";
import flagNo from "flag-icons/flags/4x3/no.svg?no-inline";
import flagPh from "flag-icons/flags/4x3/ph.svg?no-inline";
import flagPl from "flag-icons/flags/4x3/pl.svg?no-inline";
import flagRo from "flag-icons/flags/4x3/ro.svg?no-inline";
import flagSa from "flag-icons/flags/4x3/sa.svg?no-inline";
import flagSe from "flag-icons/flags/4x3/se.svg?no-inline";
import flagTh from "flag-icons/flags/4x3/th.svg?no-inline";
import flagTr from "flag-icons/flags/4x3/tr.svg?no-inline";
import flagUs from "flag-icons/flags/4x3/us.svg?no-inline";
import type { LocaleCode } from "./locales.js";

export const localeFlags: Partial<Record<LocaleCode, string>> = {
  en: flagUs,
  cs: flagCz,
  da: flagDk,
  de: flagDe,
  "es-ES": flagEs,
  fil: flagPh,
  fr: flagFr,
  id: flagId,
  it: flagIt,
  ms: flagMy,
  nl: flagNl,
  nb: flagNo,
  pl: flagPl,
  "pt-BR": flagBr,
  ro: flagRo,
  fi: flagFi,
  sv: flagSe,
  tr: flagTr,
  he: flagIl,
  ar: flagSa,
  fa: flagIr,
  hi: flagIn,
  bn: flagBd,
  th: flagTh,
  ko: flagKr,
  "zh-CN": flagCn,
  ja: flagJp,
};
