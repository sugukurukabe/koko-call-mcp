import { z } from "zod";

export const INVESTMENT_DISCLAIMER =
  "本情報は投資助言ではありません。売買の推奨は行いません。投資判断は自己責任で、公式の調達書類・開示・市場データをご自身で確認してください。 / This is not investment advice and is not a buy or sell recommendation. / Informasi ini bukan nasihat investasi dan bukan rekomendasi beli atau jual." as const;

export const JquantsAttributionSchema = z.object({
  dataSource: z.literal("J-Quants API"),
  apiEndpoint: z.literal("https://api.jquants.com/v2"),
  licenseUrl: z.literal("https://jpx-jquants.com/"),
  accessedAt: z.string().datetime(),
});

export type JquantsAttribution = z.infer<typeof JquantsAttributionSchema>;

export function createJquantsAttribution(accessedAt = new Date()): JquantsAttribution {
  return {
    dataSource: "J-Quants API",
    apiEndpoint: "https://api.jquants.com/v2",
    licenseUrl: "https://jpx-jquants.com/",
    accessedAt: accessedAt.toISOString(),
  };
}

export const MatchConfidenceSchema = z.enum(["exact", "alias", "contains", "code"]);
export type MatchConfidence = z.infer<typeof MatchConfidenceSchema>;

export const ListedCompanySchema = z.object({
  code: z.string().min(4).max(5),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  sector: z.string().min(1),
});

export type ListedCompany = z.infer<typeof ListedCompanySchema>;

export const ListedMatchSchema = z.object({
  company: ListedCompanySchema,
  confidence: MatchConfidenceSchema,
  matchedText: z.string(),
});

export type ListedMatch = z.infer<typeof ListedMatchSchema>;

type CatalogRow = readonly [code: string, name: string, sector: string, ...aliases: string[]];

// 官公需で頻出するプライム中心の名寄せカタログ。全上場の網羅は J-Quants マスタに任せる。
// Curated name catalog centered on Prime names that often appear in public procurement.
// Katalog nama kurasi (Prime) yang sering muncul di pengadaan publik.
const CATALOG_ROWS: readonly CatalogRow[] = [
  ["1801", "大成建設", "建設", "TAISEI"],
  ["1802", "大林組", "建設", "OBAYASHI"],
  ["1803", "清水建設", "建設", "SHIMIZU"],
  ["1812", "鹿島建設", "建設", "鹿島", "KAJIMA"],
  ["1820", "西松建設", "建設"],
  ["1821", "三井住友建設", "建設"],
  ["1824", "前田建設工業", "建設", "前田建設"],
  ["1860", "戸田建設", "建設"],
  ["1861", "熊谷組", "建設"],
  ["1893", "五洋建設", "建設"],
  ["1911", "住友林業", "建設"],
  ["1925", "大和ハウス工業", "建設", "大和ハウス"],
  ["1928", "積水ハウス", "建設"],
  ["1944", "きんでん", "建設"],
  ["1951", "エクシオグループ", "情報通信", "エクシオ"],
  ["1963", "日揮ホールディングス", "建設", "日揮", "JGC"],
  ["1969", "高砂熱学工業", "建設"],
  ["1973", "ＮＥＣネッツエスアイ", "情報通信", "NECネッツエスアイ"],
  ["2327", "日鉄ソリューションズ", "情報通信", "NSSOL"],
  ["3402", "東レ", "素材"],
  ["3407", "旭化成", "素材"],
  ["3626", "ＴＩＳ", "情報通信", "TIS"],
  ["3994", "マネーフォワード", "情報通信", "Money Forward"],
  ["4063", "信越化学工業", "素材", "信越化学"],
  ["4188", "三菱ケミカルグループ", "素材", "三菱ケミカル"],
  ["4307", "野村総合研究所", "情報通信", "ＮＲＩ", "NRI"],
  ["4478", "フリー", "情報通信", "freee"],
  ["4502", "武田薬品工業", "医薬品", "武田薬品", "TAKEDA"],
  ["4503", "アステラス製薬", "医薬品", "アステラス"],
  ["4519", "中外製薬", "医薬品"],
  ["4568", "第一三共", "医薬品"],
  ["4684", "オービック", "情報通信"],
  ["4689", "ＬＩＮＥヤフー", "情報通信", "LINEヤフー", "ヤフー", "Yahoo"],
  ["4755", "楽天グループ", "情報通信", "楽天"],
  ["4768", "大塚商会", "情報通信"],
  ["4901", "富士フイルムホールディングス", "素材", "富士フイルム"],
  ["5108", "ブリヂストン", "輸送用機器"],
  ["5401", "日本製鉄", "鉄鋼", "日鉄", "NIPPON STEEL"],
  ["5411", "ＪＦＥホールディングス", "鉄鋼", "JFE"],
  ["6098", "リクルートホールディングス", "サービス", "リクルート"],
  ["6178", "日本郵政", "サービス"],
  ["6301", "小松製作所", "機械", "コマツ", "KOMATSU"],
  ["6326", "クボタ", "機械", "KUBOTA"],
  ["6367", "ダイキン工業", "機械", "ダイキン"],
  ["6501", "日立製作所", "電気機器", "日立", "HITACHI"],
  ["6503", "三菱電機", "電気機器"],
  ["6594", "ニデック", "電気機器", "Nidec"],
  ["6645", "オムロン", "電気機器"],
  ["6701", "日本電気", "電気機器", "ＮＥＣ", "NEC"],
  ["6702", "富士通", "電気機器", "FUJITSU"],
  ["6752", "パナソニックホールディングス", "電気機器", "パナソニック"],
  ["6758", "ソニーグループ", "電気機器", "ソニー", "SONY"],
  ["6861", "キーエンス", "電気機器"],
  ["6902", "デンソー", "輸送用機器"],
  ["6954", "ファナック", "電気機器", "FANUC"],
  ["6981", "村田製作所", "電気機器"],
  ["7011", "三菱重工業", "機械", "三菱重工"],
  ["7012", "川崎重工業", "輸送用機器", "川崎重工"],
  ["7013", "ＩＨＩ", "機械", "IHI"],
  ["7201", "日産自動車", "輸送用機器", "日産", "NISSAN"],
  ["7203", "トヨタ自動車", "輸送用機器", "トヨタ", "TOYOTA"],
  ["7267", "本田技研工業", "輸送用機器", "ホンダ", "HONDA"],
  ["7269", "スズキ", "輸送用機器"],
  ["7270", "ＳＵＢＡＲＵ", "輸送用機器", "SUBARU"],
  ["7733", "オリンパス", "精密機器"],
  ["7751", "キヤノン", "電気機器", "CANON"],
  ["7911", "ＴＯＰＰＡＮホールディングス", "その他", "凸版印刷", "TOPPAN"],
  ["7912", "ＤＮＰ", "その他", "大日本印刷"],
  ["7974", "任天堂", "その他", "NINTENDO"],
  ["8001", "伊藤忠商事", "卸売", "伊藤忠"],
  ["8002", "丸紅", "卸売"],
  ["8031", "三井物産", "卸売"],
  ["8035", "東京エレクトロン", "電気機器"],
  ["8053", "住友商事", "卸売"],
  ["8056", "ＢＩＰＲＯＧＹ", "情報通信", "BIPROGY", "日本ユニシス"],
  ["8058", "三菱商事", "卸売"],
  ["8267", "イオン", "小売"],
  ["8306", "三菱ＵＦＪフィナンシャル・グループ", "銀行", "三菱UFJ", "MUFG"],
  ["8316", "三井住友フィナンシャルグループ", "銀行", "三井住友FG", "SMFG"],
  ["8411", "みずほフィナンシャルグループ", "銀行", "みずほ", "Mizuho"],
  ["8591", "オリックス", "その他金融"],
  ["8601", "大和証券グループ本社", "証券", "大和証券"],
  ["8604", "野村ホールディングス", "証券", "野村"],
  ["8725", "ＭＳ＆ＡＤインシュアランスグループホールディングス", "保険", "MS&AD"],
  ["8766", "東京海上ホールディングス", "保険", "東京海上"],
  ["8801", "三井不動産", "不動産"],
  ["8802", "三菱地所", "不動産"],
  ["9020", "東日本旅客鉄道", "陸運", "JR東日本"],
  ["9021", "西日本旅客鉄道", "陸運", "JR西日本"],
  ["9022", "東海旅客鉄道", "陸運", "JR東海"],
  ["9101", "日本郵船", "海運"],
  ["9104", "商船三井", "海運"],
  ["9201", "日本航空", "空運", "JAL"],
  ["9202", "ＡＮＡホールディングス", "空運", "ANA"],
  ["9432", "日本電信電話", "情報通信", "ＮＴＴ", "NTT"],
  ["9433", "ＫＤＤＩ", "情報通信", "KDDI"],
  ["9434", "ソフトバンク", "情報通信"],
  ["9501", "東京電力ホールディングス", "電気・ガス", "東京電力", "TEPCO"],
  ["9503", "関西電力", "電気・ガス"],
  ["9508", "九州電力", "電気・ガス"],
  ["9613", "ＮＴＴデータグループ", "情報通信", "NTTデータ", "NTT DATA"],
  ["9682", "ＤＴＳ", "情報通信", "DTS"],
  ["9702", "アイネス", "情報通信"],
  ["9719", "ＳＣＳＫ", "情報通信", "SCSK"],
  ["9735", "セコム", "サービス", "SECOM"],
  ["9983", "ファーストリテイリング", "小売", "ユニクロ"],
  ["9984", "ソフトバンクグループ", "情報通信", "SBG"],
];

const LEGAL_ENTITY_PATTERN =
  /株式会社|（株）|\(株\)|㈱|有限会社|合同会社|合資会社|合名会社|一般社団法人|公益社団法人|一般財団法人|公益財団法人/g;

const HOLDING_PATTERN = /ホールディングス|Ｈｏｌｄｉｎｇｓ|Holdings|ＨＤ|HD$/gi;

export function bundledListedCompanies(): ListedCompany[] {
  return CATALOG_ROWS.map(([code, name, sector, ...aliases]) => ({
    code,
    name,
    sector,
    aliases,
  }));
}

export function normalizeCompanyName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(LEGAL_ENTITY_PATTERN, "")
    .replace(HOLDING_PATTERN, "")
    .replace(/[\s　・･.,，、]/g, "")
    .trim();
}

export function normalizeTickerCode(value: string): string | undefined {
  const digits = value.normalize("NFKC").replace(/\D/g, "");
  if (digits.length === 4) {
    return digits;
  }
  if (digits.length === 5 && digits.endsWith("0")) {
    return digits.slice(0, 4);
  }
  return undefined;
}

export function indexListedCompanies(
  companies: readonly ListedCompany[],
): Map<string, ListedCompany> {
  const index = new Map<string, ListedCompany>();
  for (const company of companies) {
    index.set(`code:${company.code}`, company);
    index.set(`name:${normalizeCompanyName(company.name)}`, company);
    for (const alias of company.aliases) {
      const normalized = normalizeCompanyName(alias);
      if (normalized.length >= 2) {
        index.set(`name:${normalized}`, company);
      }
    }
  }
  return index;
}

export function findListedCompany(
  query: string,
  companies: readonly ListedCompany[] = bundledListedCompanies(),
): ListedMatch | undefined {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const index = indexListedCompanies(companies);
  const code = normalizeTickerCode(trimmed);
  if (code) {
    const company = index.get(`code:${code}`);
    if (company) {
      return { company, confidence: "code", matchedText: trimmed };
    }
  }
  const normalized = normalizeCompanyName(trimmed);
  if (normalized.length < 2) {
    return undefined;
  }
  const exact = index.get(`name:${normalized}`);
  if (exact) {
    const confidence: MatchConfidence =
      normalizeCompanyName(exact.name) === normalized ? "exact" : "alias";
    return { company: exact, confidence, matchedText: trimmed };
  }
  return undefined;
}

export function matchListedCompaniesInText(
  text: string,
  companies: readonly ListedCompany[] = bundledListedCompanies(),
): ListedMatch[] {
  const haystack = normalizeCompanyName(text);
  if (haystack.length < 2) {
    return [];
  }
  const matches: ListedMatch[] = [];
  const seen = new Set<string>();
  for (const company of companies) {
    const names = [company.name, ...company.aliases]
      .map((name) => normalizeCompanyName(name))
      .filter((name) => name.length >= 2)
      .sort((left, right) => right.length - left.length);
    for (const needle of names) {
      if (!haystack.includes(needle)) {
        continue;
      }
      if (seen.has(company.code)) {
        break;
      }
      seen.add(company.code);
      const confidence: MatchConfidence =
        needle === normalizeCompanyName(company.name) ? "contains" : "alias";
      matches.push({ company, confidence, matchedText: needle });
      break;
    }
  }
  return matches;
}
