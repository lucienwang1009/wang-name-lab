import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_PROFILE_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  clearStoredProfile,
  createDefaultProfile,
  exportProfile,
  loadProfile,
  parseProfile,
  saveProfile,
} from "./storage";

describe("本地家庭档案", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("损坏或缺失的数据安全回退到默认值", () => {
    expect(parseProfile(null)).toEqual(createDefaultProfile());
    expect(parseProfile("{not-json")).toEqual(createDefaultProfile());
  });

  it("限制命理权重和对比数量", () => {
    const profile = parseProfile(
      JSON.stringify({
        version: 1,
        metaphysicsWeight: 0.9,
        compareNames: ["甲", "乙", "丙", "丁", "戊"],
      }),
    );

    expect(profile.version).toBe(2);
    expect(profile.metaphysicsWeight).toBe(0.1);
    expect(profile.compareNames).toEqual(["甲", "乙", "丙", "丁"]);
    expect(profile.birth.metaphysicsNote).toMatch(/丙午 丙申 甲子 丁卯/);
    expect(profile.birth.metaphysicsNote).toMatch(/实际出生时间与地点确认前不参与排序/);
  });

  it("从旧版迁移收藏、排除、对比、备注和出生资料，但丢弃旧评分与批次", () => {
    const profile = parseProfile(
      JSON.stringify({
        version: 1,
        favoriteNames: ["王令仪"],
        rejectedNames: ["王芳菲"],
        compareNames: ["王令仪", "王疏影"],
        notes: { 王令仪: "尚可" },
        assessments: { 王令仪: { score: 72, rationale: "旧记录" } },
        birthStatus: "已出生",
        birth: {
          date: "2026-08-18",
          time: "06:30",
          city: "长春",
          fourPillars: "丙午 丙申 甲子 丁卯",
        },
        culturalScores: { 王令仪: 96 },
        currentBatchIds: ["legacy:1"],
      }),
    );

    expect(profile).toMatchObject({
      version: 2,
      favoriteNames: ["王令仪"],
      rejectedNames: ["王芳菲"],
      compareNames: ["王令仪", "王疏影"],
      notes: { 王令仪: "尚可" },
      birthStatus: "已出生",
      birth: {
        date: "2026-08-18",
        time: "06:30",
        city: "长春",
        fourPillars: "丙午 丙申 甲子 丁卯",
      },
      preference: {
        feedback: [],
        explicitFeedback: {},
        calibrationProgress: 0,
        exposureCounts: {},
        reactions: {},
        reactionOrder: [],
      },
    });
    expect(profile).not.toHaveProperty("culturalScores");
    expect(profile).not.toHaveProperty("currentBatchIds");
  });

  it("保存有效的连续反馈并过滤损坏的反馈顺序", () => {
    const defaults = createDefaultProfile();
    const profile = parseProfile(JSON.stringify({
      version: 2,
      preference: {
        ...defaults.preference,
        reactions: {
          王令仪: "love",
          王疏影: "skip",
          王错误: "maybe",
        },
        reactionOrder: ["王令仪", "王不存在", "王疏影", "王令仪"],
      },
    }));

    expect(profile.preference.reactions).toEqual({
      王令仪: "love",
      王疏影: "skip",
    });
    expect(profile.preference.reactionOrder).toEqual(["王令仪", "王疏影"]);
  });

  it("偏好资料损坏时只重置偏好模型并保留家庭资料", () => {
    const profile = parseProfile(
      JSON.stringify({
        version: 2,
        favoriteNames: ["王令仪"],
        preference: {
          weights: { classical: "invalid" },
          feedback: "invalid",
          calibrationProgress: 99,
        },
      }),
    );

    expect(profile.favoriteNames).toEqual(["王令仪"]);
    expect(profile.preference).toEqual(createDefaultProfile().preference);
  });

  it("读取旧存储键时自动迁移到新版存储键", () => {
    localStorage.setItem(
      LEGACY_PROFILE_STORAGE_KEY,
      JSON.stringify({ version: 1, favoriteNames: ["王令仪"] }),
    );

    const profile = loadProfile();

    expect(profile.version).toBe(2);
    expect(profile.favoriteNames).toEqual(["王令仪"]);
    expect(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? "null")).toEqual(
      profile,
    );
  });

  it("可以保存、读取、导出和清除档案", () => {
    const profile = {
      ...createDefaultProfile(),
      favoriteNames: ["王皎舒"],
      birth: {
        ...createDefaultProfile().birth,
        city: "上海",
      },
    };

    saveProfile(profile);
    expect(loadProfile()).toEqual(profile);
    expect(JSON.parse(exportProfile(profile))).toEqual(profile);

    clearStoredProfile();
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it("所有存储操作都不会发起网络请求", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const profile = createDefaultProfile();

    saveProfile(profile);
    loadProfile();
    exportProfile(profile);
    clearStoredProfile();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
