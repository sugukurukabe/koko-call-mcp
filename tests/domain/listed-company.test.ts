import { describe, expect, it } from "vitest";
import {
  bundledListedCompanies,
  findListedCompany,
  matchListedCompaniesInText,
  normalizeCompanyName,
  normalizeTickerCode,
} from "../../src/domain/listed-company.js";

describe("listed company matching", () => {
  it("strips legal-entity prefixes and holding suffixes", () => {
    expect(normalizeCompanyName("株式会社富士通")).toBe("富士通");
    expect(normalizeCompanyName("（株）ＮＥＣ")).toBe("NEC");
    expect(normalizeCompanyName("トヨタ自動車ホールディングス")).toBe("トヨタ自動車");
  });

  it("normalizes 4-digit and J-Quants 5-digit codes", () => {
    expect(normalizeTickerCode("7203")).toBe("7203");
    expect(normalizeTickerCode("72030")).toBe("7203");
    expect(normalizeTickerCode("abc")).toBeUndefined();
  });

  it("finds bundled companies by ticker, exact name, and alias", () => {
    expect(findListedCompany("7203")?.company.name).toBe("トヨタ自動車");
    expect(findListedCompany("富士通株式会社")?.confidence).toBe("exact");
    expect(findListedCompany("NTTデータ")?.company.code).toBe("9613");
    expect(findListedCompany("unknown-co")).toBeUndefined();
  });

  it("matches companies mentioned in bid text without false short hits", () => {
    const matches = matchListedCompaniesInText(
      "富士通株式会社による鹿児島市システム保守。NECの機器更新を含む。",
    );
    expect(matches.map((match) => match.company.code).sort()).toEqual(["6701", "6702"]);
    expect(matchListedCompaniesInText("鹿児島市上下水道台帳")).toEqual([]);
  });

  it("exposes a non-empty bundled catalog with unique codes", () => {
    const companies = bundledListedCompanies();
    expect(companies.length).toBeGreaterThan(80);
    expect(new Set(companies.map((company) => company.code)).size).toBe(companies.length);
  });
});
