"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import Map, {
  Layer,
  type MapMouseEvent,
  NavigationControl,
  Popup,
  Source,
} from "react-map-gl/mapbox";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { PROJECT_STATUS_META, PROJECT_STATUS_ORDER, TONE_HEX } from "@/lib/domain";
import { formatCount, formatMw, formatMonthYear, formatUsdCompact } from "@/lib/format";
import {
  type MapProjectInput,
  SIZE_METRIC_LABEL,
  type SizeMetric,
  buildFeatureCollection,
  countUnplottable,
} from "@/lib/map-data";

const CLUSTER_SOURCE = "projects";

export function ProjectMap({
  projects,
  mapboxToken,
}: {
  projects: MapProjectInput[];
  mapboxToken: string | undefined;
}) {
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("power");
  const [selected, setSelected] = useState<string | null>(null);

  const collection = useMemo(
    () => buildFeatureCollection(projects, sizeMetric),
    [projects, sizeMetric],
  );
  const unplottable = useMemo(() => countUnplottable(projects), [projects]);

  const selectedFeature = collection.features.find((f) => f.properties.id === selected);

  // Without a token Mapbox cannot render at all. Rather than a broken grey box,
  // show what the map would contain and how to enable it.
  if (!mapboxToken) {
    return (
      <div className="rounded-lg border border-line bg-panel">
        <EmptyState
          icon={<MapPinOff className="size-6" />}
          title="Map needs a Mapbox token"
          description={`Set NEXT_PUBLIC_MAPBOX_TOKEN in .env to a public (pk.*) token and restart the dev server. ${collection.features.length} of ${projects.length} projects have coordinates and are ready to plot.`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Browse the database instead</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[11px] text-fg-dim">
          <span className="eyebrow">Size by</span>
          <Select
            value={sizeMetric}
            onChange={(e) => setSizeMetric(e.target.value as SizeMetric)}
            className="w-auto"
            aria-label="Marker size metric"
          >
            {(Object.keys(SIZE_METRIC_LABEL) as SizeMetric[]).map((m) => (
              <option key={m} value={m}>
                {SIZE_METRIC_LABEL[m]}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Status</span>
          {PROJECT_STATUS_ORDER.map((status) => (
            <span
              key={status}
              className="inline-flex items-center gap-1 text-[10px] text-fg-muted"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: TONE_HEX[PROJECT_STATUS_META[status].tone] }}
              />
              {PROJECT_STATUS_META[status].label}
            </span>
          ))}
        </div>

        <p className="ml-auto num text-[11px] text-fg-muted">
          {formatCount(collection.features.length)} plotted
          {unplottable > 0 ? ` · ${formatCount(unplottable)} without coordinates` : ""}
        </p>
      </div>

      <div className="h-[640px] overflow-hidden rounded-lg border border-line">
        <Map
          mapboxAccessToken={mapboxToken}
          initialViewState={{ longitude: -30, latitude: 35, zoom: 1.6 }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          interactiveLayerIds={["clusters", "unclustered"]}
          onClick={(event: MapMouseEvent) => {
            const feature = event.features?.[0];
            const id = feature?.properties?.id;
            setSelected(typeof id === "string" ? id : null);
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="top-right" showCompass={false} />

          <Source
            id={CLUSTER_SOURCE}
            type="geojson"
            data={collection}
            cluster
            clusterRadius={45}
            clusterMaxZoom={6}
          >
            {/* Clusters: count-scaled circles with the count printed inside. */}
            <Layer
              id="clusters"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "#0b3d4d",
                "circle-stroke-color": "#00D4FF",
                "circle-stroke-width": 1.5,
                "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 20, 30],
              }}
            />
            <Layer
              id="cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 12,
              }}
              paint={{ "text-color": "#E8E8E8" }}
            />

            {/* Individual projects: colour = status, radius precomputed by
                lib/map-data so area scales with the chosen metric. */}
            <Layer
              id="unclustered"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": ["get", "color"],
                "circle-radius": ["get", "radius"],
                "circle-opacity": 0.75,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#0A0A0A",
              }}
            />
          </Source>

          {selectedFeature ? (
            <Popup
              longitude={selectedFeature.geometry.coordinates[0]}
              latitude={selectedFeature.geometry.coordinates[1]}
              onClose={() => setSelected(null)}
              closeOnClick={false}
              maxWidth="300px"
            >
              <div className="min-w-[220px] space-y-1.5 bg-panel p-1 text-fg">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/projects/${selectedFeature.properties.slug}`}
                    className="text-[13px] font-semibold text-cyan hover:underline"
                  >
                    {selectedFeature.properties.name}
                  </Link>
                  {selectedFeature.properties.isDemoData ? (
                    <Badge tone="risk">Demo</Badge>
                  ) : null}
                </div>
                <p className="text-[11px] text-fg-muted">
                  {selectedFeature.properties.owner} ·{" "}
                  {selectedFeature.properties.location}
                </p>
                <StatusBadge status={selectedFeature.properties.status} />
                <dl className="num grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 text-[11px]">
                  <dt className="text-fg-muted">Power</dt>
                  <dd>{formatMw(selectedFeature.properties.powerMw)}</dd>
                  <dt className="text-fg-muted">GPUs</dt>
                  <dd>{formatCount(selectedFeature.properties.gpuCount)}</dd>
                  <dt className="text-fg-muted">Capex</dt>
                  <dd>{formatUsdCompact(selectedFeature.properties.capexUsd)}</dd>
                  <dt className="text-fg-muted">Opening</dt>
                  <dd>{formatMonthYear(selectedFeature.properties.expectedOpening)}</dd>
                </dl>
                {selectedFeature.properties.isEstimated ? (
                  <p className="text-[10px] text-amber">
                    Marker sized from an estimate, not a confirmed figure.
                  </p>
                ) : null}
              </div>
            </Popup>
          ) : null}
        </Map>
      </div>

      <p className="text-[11px] leading-relaxed text-fg-muted">
        Marker area is proportional to the selected metric (square-root radius scaling),
        so a project twice the size looks twice as big rather than four times. Projects
        with no value for the chosen metric render at the minimum size rather than
        disappearing.
      </p>
    </div>
  );
}
