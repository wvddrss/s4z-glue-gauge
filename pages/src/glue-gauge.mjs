import * as sauce from "/shared/sauce/index.mjs";
import * as common from "/pages/src/common.mjs";
// unfortunately this didnt work:
// import * as echarts from '/pages/deps/src/echarts.mjs';
import * as echarts from "../deps/src/echarts.mjs";
import { cssColor, getTheme } from "/pages/src/echarts-sauce-theme.mjs";

echarts.registerTheme("sauce", getTheme("dynamic"));

const doc = document.documentElement;
const L = sauce.locale;
const H = L.human;
let settings; // eslint-disable-line prefer-const
let sport = "cycling";
let imperial = !!common.storage.get("/imperialUnits");
L.setImperial(imperial);

const defaultAxisColorBands = [[1, cssColor("fg", 1, 0.2)]];

let currentGroupAvg;

common.subscribe("groups", (groups) => {
  if (!groups.length) {
    return;
  }
  const groupCenterIdx = groups.find((x) => x.watching);
  currentGroupAvg = groupCenterIdx.power;
});

const getBound = (avg, type, number) => {
  if (type === "w") {
    return avg + number;
  } else {
    return avg + (number / 100) * avg;
  }
};

const gaugeConfig = {
  name: "Glue",
  defaultSettings: {
    min: 100,
    max: 500,
    groupAvgMinType: "w", //if not absolute is percentage wise /  | "%"
    groupAvgMin: -20,
    groupAvgMaxType: "w", //if not absolute is percentage wise /  | "%"
    groupAvgMax: 20,
  },
  boringMode: true,
  defaultColor: "#35e",
  getValue: (x) =>
    settings.dataSmoothing
      ? x.stats.power.smooth[settings.dataSmoothing]
      : x.state.power,
  getAvgValue: (x) =>
    (settings.currentLap ? x.stats.laps.at(-1).power : x.stats.power).avg,
  getMaxValue: (x) =>
    (settings.currentLap ? x.stats.laps.at(-1).power : x.stats.power).max,
  getLabel: H.number,
  detailFormatter: (x) => `{value|${H.power(x)}}\n{unit|watts}`,
  axisColorBands: () => {
    const min = settings.min;
    const delta = settings.max - min;
    const powerMin =
      (getBound(
        currentGroupAvg,
        settings.groupAvgMinType,
        settings.groupAvgMin
      ) -
        min) /
      delta;
    const power = currentGroupAvg / delta;
    const powerMax =
      (getBound(
        currentGroupAvg,
        settings.groupAvgMaxType,
        settings.groupAvgMax
      ) -
        min) /
      delta;

    const bands = [
      [powerMin, "#0005"],
      [powerMax, settings.rangeColor],
      [powerMax + 99999999999, "#0005"],
    ];

    return bands;
  },
  noSmoothing: true,
};

const config = gaugeConfig;
const settingsStore = new common.SettingsStore(`gauge-settings-v1-glue`);
settings = settingsStore.get(null, {
  refreshInterval: 1,
  dataSmoothing: 0,
  showAverage: false,
  showMax: false,
  currentLap: false,
  boringMode: true,
  gaugeTransparency: 20,
  solidBackground: false,
  backgroundColor: "#00ff00",
  colorOverride: false,
  color: "#7700ff",
  rangeColor: "#67e0e3",
  ...config.defaultSettings,
});
common.themeInit(settingsStore);
doc.classList.remove("hidden-during-load");
config.color = settings.colorOverride ? settings.color : config.defaultColor;

function setBackground() {
  const { solidBackground, backgroundColor } = settings;
  doc.classList.toggle("solid-background", solidBackground);
  if (solidBackground) {
    doc.style.setProperty("--background-color", backgroundColor);
  } else {
    doc.style.removeProperty("--background-color");
  }
}

function colorAlpha(color, alpha) {
  if (color.length <= 5) {
    return color.slice(0, 4) + alpha[0];
  } else {
    return color.slice(0, 7) + alpha.padStart(2, alpha[0]);
  }
}

export function main() {
  common.initInteractionListeners();
  setBackground();
  const content = document.querySelector("#content");
  const gauge = echarts.init(content.querySelector(".gauge"), "sauce", {
    renderer: "svg",
  });
  let relSize;
  const initGauge = () => {
    // Can't use em for most things on gauges. :(
    relSize = Math.min(content.clientHeight * 1.2, content.clientWidth) / 600;
    gauge.setOption({
      animationDurationUpdate: Math.max(
        200,
        Math.min(settings.refreshInterval * 1000, 1000)
      ),
      animationEasingUpdate: "linear",
      tooltip: {},
      visualMap: config.visualMap,
      graphic: [
        {
          elements: [
            {
              left: "center",
              top: "middle",
              type: "circle",
              shape: {
                r: 270 * relSize,
              },
              style: {
                shadowColor: cssColor("fg", 1, 2 / 3),
                shadowBlur: 5 * relSize,
                fill: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    {
                      offset: 0,
                      color: "#000",
                    },
                    {
                      offset: 0.5,
                      color: colorAlpha(config.color, "f"),
                    },
                    {
                      offset: 0.75,
                      color: config.color,
                    },
                    {
                      offset: 0.75,
                      color: "#0000",
                    },
                    {
                      offset: 1,
                      color: "#0000",
                    },
                  ],
                },
                lineWidth: 0,
                opacity: 1 - settings.gaugeTransparency / 100,
              },
            },
          ],
        },
      ],
      series: [
        {
          radius: "90%", // fill space
          splitNumber: config.ticks || 7,
          name: config.name,
          type: "gauge",
          min: settings.min,
          max: settings.max,
          startAngle: 210,
          endAngle: 330,
          progress: {
            show: true,
            width: 60 * relSize,
            itemStyle: !config.visualMap
              ? {
                  color: config.axisColorBands
                    ? "#fff3"
                    : colorAlpha(config.color, "4"),
                }
              : undefined,
          },
          axisLine: {
            lineStyle: {
              color: defaultAxisColorBands,
              width: 60 * relSize,
              shadowColor: cssColor("fg", 1, 0.5),
              shadowBlur: 8 * relSize,
            },
          },
          axisTick: {
            show: false,
          },
          splitLine: {
            show: true,
            distance: 10 * relSize,
            length: 10 * relSize,
            lineStyle: {
              width: 3 * relSize,
            },
          },
          axisLabel: {
            distance: 70 * relSize,
            fontSize: 20 * relSize,
            formatter: config.getLabel,
            textShadowColor: cssColor("fg", 1, 0.5),
            textShadowBlur: 1 * relSize,
          },
          pointer: settings.boringMode
            ? {
                // NOTE: Important that all are set so it's not an update
                icon: null,
                width: 6 * relSize,
                length: 180 * relSize,
                offsetCenter: [0, 0],
                itemStyle: {
                  color: config.color,
                  opacity: 0.9,
                  borderColor: cssColor("fg", 0, 0.9),
                  borderWidth: 2 * relSize,
                  shadowColor: cssColor("fg", 1, 0.4),
                  shadowBlur: 4 * relSize,
                },
              }
            : {
                width: 70 * relSize,
                length: 180 * relSize,
                icon: "image:///pages/images/logo_vert_120x320.png",
                offsetCenter: [0, "10%"],
              },
          anchor: settings.boringMode
            ? {
                showAbove: true,
                show: true,
                size: 25 * relSize,
                itemStyle: {
                  color: config.color,
                  borderColor: cssColor("fg", 0, 0.9),
                  borderWidth: 2 * relSize,
                  shadowColor: cssColor("fg", 1, 0.5),
                  shadowBlur: 4 * relSize,
                },
              }
            : { show: false },
          detail: {
            valueAnimation: true,
            formatter: config.detailFormatter,
            textShadowColor: cssColor("fg", 1, 0.4),
            textShadowBlur: 1 * relSize,
            offsetCenter: [0, "32%"],
            rich: {
              value: {
                color: cssColor("fg"),
                fontSize: 80 * relSize,
                fontWeight: "bold",
                lineHeight: 70 * relSize,
              },
              unit: {
                fontSize: 18 * relSize,
                color: cssColor("fg", 0, 0.88),
                lineHeight: 16 * relSize,
              },
            },
          },
        },
      ],
    });
  };
  initGauge();
  const renderer = new common.Renderer(content, {
    fps: 1 / settings.refreshInterval,
  });
  renderer.addCallback((data) => {
    const axisColorBands = config.axisColorBands
      ? data && config.axisColorBands(data)
      : defaultAxisColorBands;
    const series = {
      axisLine: {
        lineStyle: { color: axisColorBands || defaultAxisColorBands },
      },
    };
    if (data) {
      series.data = [
        {
          name: config.name,
          title: {
            offsetCenter: [0, "-30%"],
            color: cssColor("fg", 0, 0.9),
            fontSize: 80 * relSize * (1 - (config.name.length / 6) * 0.3),
            fontWeight: 700,
            textShadowColor: cssColor("fg", 1, 0.4),
            textShadowBlur: 2 * relSize,
          },
          value: config.getValue(data),
        },
      ];
    }
    gauge.setOption({ series: [series] });
  });
  addEventListener("resize", () => {
    initGauge();
    gauge.resize();
    renderer.render({ force: true });
  });
  let reanimateTimeout;
  settingsStore.addEventListener("changed", (ev) => {
    const changed = ev.data.changed;
    if (changed.has("/imperialUnits")) {
      imperial = changed.get("/imperialUnits");
      L.setImperial(imperial);
    }
    if (changed.has("color") || changed.has("colorOverride")) {
      config.color = settings.colorOverride
        ? settings.color
        : config.defaultColor;
    }
    setBackground();
    renderer.fps = 1 / settings.refreshInterval;
    initGauge();
    gauge.setOption({ series: [{ animation: false }] });
    renderer.render({ force: true });
    clearTimeout(reanimateTimeout);
    reanimateTimeout = setTimeout(
      () => gauge.setOption({ series: [{ animation: true }] }),
      400
    );
  });
  common.subscribe("athlete/watching", (watching) => {
    sport = watching.state.sport;
    renderer.setData(watching);
    renderer.render();
  });
  renderer.render();
}

export async function settingsMain() {
  common.initInteractionListeners();
  if (config.noSmoothing) {
    document.querySelector('form [name="dataSmoothing"]').disabled = true;
  }
  if (config.longPeriods) {
    Array.from(
      document.querySelectorAll(
        'form [name="dataSmoothing"] [data-period="short"]'
      )
    ).map((x) => (x.disabled = true));
  }
  await common.initSettingsForm("form", { store: settingsStore })();
}
