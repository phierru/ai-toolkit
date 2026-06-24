const MACSTATS_KEY = Symbol.for('ai-toolkit.macstats.native');

type SmcBinding = {
  cpuTemperatureDie: () => number;
  cpuVoltage: () => number;
  fanMax: (index: number) => number;
  fanMin: (index: number) => number;
  fanRpm: (index: number) => number;
  fans: () => number;
  getAllPower: () => Record<string, number>;
  getRAMUsageData: () => {
    active: number;
    app: number;
    cache: number;
    compressed: number;
    free: number;
    inactive: number;
    pressure_level: number;
    swap_free: number;
    swap_total: number;
    swap_used: number;
    total: number;
    used: number;
    wired: number;
  };
  gpuTemperature: () => number;
  gpuUsage: () => number;
  gpuVoltage: () => number;
  temperature: () => number;
};

type MacstatsCompat = {
  getCpuDataSync: () => { temperature: number; temperatureDie: number; voltage: number };
  getFanDataSync: () => Record<string, { rpm: number; min: number; max: number }>;
  getGpuDataSync: () => { temperature: number; usage: number; voltage: number };
  getPowerDataSync: () => Record<string, number>;
  getRAMUsageSync: () => {
    active: number;
    activeGB: number;
    app: number;
    appGB: number;
    cache: number;
    cacheGB: number;
    compressed: number;
    compressedGB: number;
    free: number;
    freeGB: number;
    inactive: number;
    inactiveGB: number;
    pressureLevel: number;
    pressureStatus: string;
    swapFree: number;
    swapFreeGB: number;
    swapTotal: number;
    swapTotalGB: number;
    swapUsed: number;
    swapUsedGB: number;
    total: number;
    totalGB: number;
    usagePercent: number;
    used: number;
    usedGB: number;
    wired: number;
    wiredGB: number;
  };
};

type GlobalWithMacstats = typeof globalThis & {
  [MACSTATS_KEY]?: MacstatsCompat;
};

function bytesToGB(bytes: number): number {
  return Math.round((bytes / 1024 ** 3) * 10) / 10;
}

function pressureStatus(level: number): string {
  if (level === 2) {
    return 'Warning';
  }
  if (level === 4) {
    return 'Critical';
  }
  return 'Normal';
}

export function loadMacstats(): MacstatsCompat {
  const globalScope = globalThis as GlobalWithMacstats;
  if (!globalScope[MACSTATS_KEY]) {
    const nativeRequire = process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json');
    const smc = nativeRequire('macstats/build/Release/smc.node') as SmcBinding;

    globalScope[MACSTATS_KEY] = {
      getCpuDataSync: () => ({
        temperature: smc.temperature(),
        temperatureDie: smc.cpuTemperatureDie(),
        voltage: smc.cpuVoltage(),
      }),
      getFanDataSync: () =>
        Array.from(Array(smc.fans()), (_, index) => ({
          rpm: smc.fanRpm(index),
          min: smc.fanMin(index),
          max: smc.fanMax(index),
        })).reduce<Record<string, { rpm: number; min: number; max: number }>>((result, fan, index) => {
          result[index] = fan;
          return result;
        }, {}),
      getGpuDataSync: () => ({
        temperature: smc.gpuTemperature(),
        voltage: smc.gpuVoltage(),
        usage: Math.round(smc.gpuUsage() * 100),
      }),
      getPowerDataSync: () => smc.getAllPower(),
      getRAMUsageSync: () => {
        const raw = smc.getRAMUsageData();
        return {
          total: raw.total,
          totalGB: bytesToGB(raw.total),
          used: raw.used,
          usedGB: bytesToGB(raw.used),
          free: raw.free,
          freeGB: bytesToGB(raw.free),
          usagePercent: raw.total > 0 ? Math.round((raw.used / raw.total) * 100) : 0,
          active: raw.active,
          activeGB: bytesToGB(raw.active),
          inactive: raw.inactive,
          inactiveGB: bytesToGB(raw.inactive),
          wired: raw.wired,
          wiredGB: bytesToGB(raw.wired),
          compressed: raw.compressed,
          compressedGB: bytesToGB(raw.compressed),
          app: raw.app,
          appGB: bytesToGB(raw.app),
          cache: raw.cache,
          cacheGB: bytesToGB(raw.cache),
          swapTotal: raw.swap_total,
          swapTotalGB: bytesToGB(raw.swap_total),
          swapUsed: raw.swap_used,
          swapUsedGB: bytesToGB(raw.swap_used),
          swapFree: raw.swap_free,
          swapFreeGB: bytesToGB(raw.swap_free),
          pressureLevel: raw.pressure_level,
          pressureStatus: pressureStatus(raw.pressure_level),
        };
      },
    };
  }

  return globalScope[MACSTATS_KEY];
}
