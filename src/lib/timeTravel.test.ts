import { afterEach, describe, expect, test } from "bun:test";
import {
  northernHemisphereTimeOfDay,
  parseDateTimeLocal,
  sameLocalDate,
  seekLocalMinute,
  simulatedDate,
  sunriseSunsetHours,
  toDateTimeLocalValue,
} from "./timeTravel";

const originalTimezone = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTimezone;
});

describe("time travel", () => {
  test("accepts years 0000 through 9999 and rejects invalid local dates", () => {
    process.env.TZ = "UTC";
    for (const value of ["0000-02-29T12:34", "0099-01-01T00:00", "9999-12-31T23:59"]) {
      expect(toDateTimeLocalValue(parseDateTimeLocal(value)!)).toBe(value);
    }
    for (const value of ["10000-01-01T00:00", "2023-02-29T12:00", "2024-01-01T24:00"]) {
      expect(parseDateTimeLocal(value)).toBeNull();
    }
  });

  test("scales elapsed time and supports pausing", () => {
    const now = Date.now();
    expect(simulatedDate(1000, now - 1000, 0).getTime()).toBe(1000);
    expect(simulatedDate(1000, now - 1000, 2).getTime()).toBeGreaterThanOrEqual(3000);
    expect(simulatedDate(1000, now - 1000, 2).getTime()).toBeLessThan(3100);
  });

  test("seeks within the local date and compares dates rather than instants", () => {
    process.env.TZ = "Europe/Stockholm";
    const date = parseDateTimeLocal("2024-06-01T12:00")!;
    expect(toDateTimeLocalValue(seekLocalMinute(date, 1439))).toBe("2024-06-01T23:59");
    expect(sameLocalDate(date, seekLocalMinute(date, 0))).toBe(true);
    expect(sameLocalDate(date, parseDateTimeLocal("2024-06-02T00:00")!)).toBe(false);
  });

  test("accounts for DST without changing the seasonal day count", () => {
    process.env.TZ = "Europe/Stockholm";
    const summer = parseDateTimeLocal("2024-06-21T12:00")!;
    const dstSun = sunriseSunsetHours(summer);
    process.env.TZ = "Etc/GMT-1";
    const standardSun = sunriseSunsetHours(parseDateTimeLocal("2024-06-21T12:00")!);
    expect(dstSun.sunrise - standardSun.sunrise).toBeCloseTo(1);
    expect(dstSun.sunset - standardSun.sunset).toBeCloseTo(1);
    process.env.TZ = "Europe/Stockholm";
    expect(northernHemisphereTimeOfDay(parseDateTimeLocal("2024-06-21T13:00")!)).toBeCloseTo(0.5);
    expect(parseDateTimeLocal("2024-03-31T02:30")).toBeNull();
  });
});
