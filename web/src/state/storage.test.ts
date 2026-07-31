import { beforeEach, describe, expect, it, vi } from "vitest";

import {
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

    expect(profile.metaphysicsWeight).toBe(0.25);
    expect(profile.compareNames).toEqual(["甲", "乙", "丙", "丁"]);
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

