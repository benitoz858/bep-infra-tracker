import { describe, expect, it } from "vitest";

import {
  MAX_RADIUS,
  MIN_RADIUS,
  type MapProjectInput,
  buildFeatureCollection,
  countUnplottable,
  metricFor,
  radiusFor,
} from "@/lib/map-data";

/**
 * The map cannot be verified end-to-end without a Mapbox token, so the data
 * layer it depends on is tested directly instead.
 */
function project(overrides: Partial<MapProjectInput> = {}): MapProjectInput {
  return {
    id: "p1",
    slug: "p1",
    name: "Project One",
    status: "ANNOUNCED",
    latitude: 40,
    longitude: -80,
    city: "Somewhere",
    stateRegion: "Ohio",
    country: "United States",
    estimatedPowerMw: null,
    confirmedPowerMw: null,
    estimatedGpuCount: null,
    confirmedGpuCount: null,
    estimatedCapexUsd: null,
    confirmedCapexUsd: null,
    expectedOpeningDate: null,
    isDemoData: false,
    ownerCompany: null,
    ...overrides,
  };
}

describe("metricFor", () => {
  it("prefers the confirmed figure and reports it as not estimated", () => {
    const result = metricFor(
      project({ confirmedPowerMw: "450", estimatedPowerMw: "900" }),
      "power",
    );
    expect(result).toEqual({ value: 450, estimated: false });
  });

  it("falls back to the estimate and flags it", () => {
    const result = metricFor(project({ estimatedPowerMw: "900" }), "power");
    expect(result).toEqual({ value: 900, estimated: true });
  });

  it("returns null when neither figure exists", () => {
    expect(metricFor(project(), "power").value).toBeNull();
    expect(metricFor(project(), "gpus").value).toBeNull();
    expect(metricFor(project(), "capex").value).toBeNull();
  });

  it("treats a confirmed zero as a real value, not as unknown", () => {
    expect(metricFor(project({ confirmedGpuCount: 0 }), "gpus")).toEqual({
      value: 0,
      estimated: false,
    });
  });
});

describe("radiusFor", () => {
  it("scales by area, not by radius", () => {
    // A project 1/4 the size of the max should have half the radius offset,
    // because area (not radius) is what the eye compares.
    const max = 1000;
    const quarter = radiusFor(250, max);
    const expected = MIN_RADIUS + 0.5 * (MAX_RADIUS - MIN_RADIUS);
    expect(quarter).toBeCloseTo(expected, 6);
  });

  it("gives the largest project the maximum radius", () => {
    expect(radiusFor(1000, 1000)).toBeCloseTo(MAX_RADIUS, 6);
  });

  it("floors unknown and zero values so they stay visible", () => {
    expect(radiusFor(null, 1000)).toBe(MIN_RADIUS);
    expect(radiusFor(0, 1000)).toBe(MIN_RADIUS);
  });

  it("does not divide by zero when nothing has a value", () => {
    expect(radiusFor(null, 0)).toBe(MIN_RADIUS);
    expect(radiusFor(100, 0)).toBe(MIN_RADIUS);
  });
});

describe("buildFeatureCollection", () => {
  it("emits GeoJSON coordinates as [longitude, latitude]", () => {
    const fc = buildFeatureCollection(
      [project({ latitude: 40, longitude: -80 })],
      "power",
    );
    // Reversing these mirrors the whole map, so it is worth an explicit test.
    expect(fc.features[0]!.geometry.coordinates).toEqual([-80, 40]);
  });

  it("excludes projects without coordinates", () => {
    const fc = buildFeatureCollection(
      [
        project({ id: "a", latitude: 40, longitude: -80 }),
        project({ id: "b", latitude: null, longitude: null }),
        project({ id: "c", latitude: 10, longitude: null }),
      ],
      "power",
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties.id).toBe("a");
  });

  it("counts the projects it could not plot", () => {
    const projects = [
      project({ id: "a" }),
      project({ id: "b", latitude: null, longitude: null }),
      project({ id: "c", longitude: null }),
    ];
    expect(countUnplottable(projects)).toBe(2);
  });

  it("colours features by status", () => {
    const fc = buildFeatureCollection(
      [
        project({ id: "op", status: "OPERATIONAL" }),
        project({ id: "cx", status: "CANCELLED" }),
      ],
      "power",
    );
    expect(fc.features[0]!.properties.color).toBe("#76B900");
    expect(fc.features[1]!.properties.color).toBe("#FF4444");
  });

  it("sizes markers relative to the largest value in the set", () => {
    const fc = buildFeatureCollection(
      [
        project({ id: "big", confirmedPowerMw: "1000" }),
        project({ id: "small", confirmedPowerMw: "250" }),
      ],
      "power",
    );
    const big = fc.features.find((f) => f.properties.id === "big")!;
    const small = fc.features.find((f) => f.properties.id === "small")!;
    expect(big.properties.radius).toBeCloseTo(MAX_RADIUS, 6);
    expect(small.properties.radius).toBeLessThan(big.properties.radius);
    expect(small.properties.radius).toBeGreaterThan(MIN_RADIUS);
  });

  it("marks a feature as estimated when the size came from an estimate", () => {
    const fc = buildFeatureCollection([project({ estimatedPowerMw: "500" })], "power");
    expect(fc.features[0]!.properties.isEstimated).toBe(true);
  });

  it("carries all three metrics regardless of which drives size", () => {
    const fc = buildFeatureCollection(
      [
        project({
          confirmedPowerMw: "450",
          confirmedGpuCount: 90_000,
          estimatedCapexUsd: "4200000000",
        }),
      ],
      "gpus",
    );
    const props = fc.features[0]!.properties;
    expect(props.powerMw).toBe(450);
    expect(props.gpuCount).toBe(90_000);
    expect(props.capexUsd).toBe(4_200_000_000);
    expect(props.metricValue).toBe(90_000);
  });
});
