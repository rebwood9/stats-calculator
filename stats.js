/* ============================================================
   stats.js
   ============================================================
   PURE STATISTICAL FUNCTIONS.

   This file contains ONLY math. Nothing knows about buttons,
   inputs, or the HTML page. Every function takes numbers as
   input and returns numbers as output.

   You can test any function in the browser console:
     descriptives([1, 2, 3, 4, 5])
     oneSampleTTest([72, 68, 75, 80, 71], 70)

   All p-values and quantiles use the jStat library, loaded
   via CDN in index.html.
   ============================================================ */


/* ============================================================
   SECTION 1: SHARED HELPERS

   Small utility functions used across multiple calculators.
   ============================================================ */

/* Parse a string of numbers separated by commas, spaces, or
   newlines into an array of numbers. */
function parseDataString(str) {
  if (!str) return [];
  return str
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(Number)
    .filter(n => !isNaN(n));
}

/* Arithmetic mean. Equivalent to R's mean(). */
function mean(arr) {
  const sum = arr.reduce((total, x) => total + x, 0);
  return sum / arr.length;
}

/* Sample standard deviation (n-1 denominator).
   Equivalent to R's sd(). */
function sampleSD(arr) {
  const m = mean(arr);
  const ss = arr.reduce((acc, x) => acc + (x - m) ** 2, 0);
  return Math.sqrt(ss / (arr.length - 1));
}

/* Population standard deviation (n denominator).
   Not built into R's base by default. */
function populationSD(arr) {
  const m = mean(arr);
  const ss = arr.reduce((acc, x) => acc + (x - m) ** 2, 0);
  return Math.sqrt(ss / arr.length);
}

/* Sample variance (n-1 denominator).
   Equivalent to R's var(). */
function sampleVariance(arr) {
  const s = sampleSD(arr);
  return s * s;
}

/* Sum of squared deviations from the mean. */
function sumOfSquares(arr) {
  const m = mean(arr);
  return arr.reduce((acc, x) => acc + (x - m) ** 2, 0);
}

/* Sort a copy of an array without mutating the original. */
function sortedCopy(arr) {
  return [...arr].sort((a, b) => a - b);
  // ^ The (a, b) => a - b comparator sorts numerically.
  //   Without it, JavaScript sorts as strings, so [10, 2, 3]
  //   would become [10, 2, 3] instead of [2, 3, 10]. Yes, really.
}


/* ============================================================
   SECTION 2: P-VALUES AND CRITICAL VALUES

   Wrappers around jStat that mirror how R names things.
   ============================================================ */

/* Two-tailed p-value from t distribution.
   R equivalent: 2 * pt(-abs(t), df) */
function tPvalueTwoTailed(t, df) {
  return 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
}

/* Two-tailed p-value from standard normal (z) distribution.
   R equivalent: 2 * pnorm(-abs(z)) */
function zPvalueTwoTailed(z) {
  return 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
}

/* One-tailed p-values from the t distribution.
   'upper' → p = P(T ≥ t) = 1 − cdf(t)
   'lower' → p = P(T ≤ t) = cdf(t)
   R equivalents: pt(t, df, lower.tail = FALSE) and pt(t, df). */
function tPvalueUpper(t, df) {
  return 1 - jStat.studentt.cdf(t, df);
}
function tPvalueLower(t, df) {
  return jStat.studentt.cdf(t, df);
}

/* Critical t for a ONE-tailed test at significance level (1 − confidence).
   Uses upperTail = confidence (not (1+confidence)/2), which is the
   one-sided cutoff. R equivalent: qt(confidence, df). */
function tCriticalOneTailed(df, confidence) {
  return jStat.studentt.inv(confidence, df);
}

/* One-tailed p-values from the standard normal (z) distribution.
   'upper' tests H1: mean > mu0  → p = P(Z ≥ z) = 1 − Phi(z)
   'lower' tests H1: mean < mu0  → p = P(Z ≤ z) = Phi(z)
   R equivalents: pnorm(z, lower.tail = FALSE) and pnorm(z). */
function zPvalueUpper(z) {
  return 1 - jStat.normal.cdf(z, 0, 1);
}
function zPvalueLower(z) {
  return jStat.normal.cdf(z, 0, 1);
}

/* One-tailed p-value from F distribution (right tail, as in ANOVA).
   R equivalent: pf(F, df1, df2, lower.tail = FALSE) */
function fPvalue(F, df1, df2) {
  return 1 - jStat.centralF.cdf(F, df1, df2);
}

/* Critical t value for a two-tailed CI at given confidence.
   R equivalent: qt(1 - (1-conf)/2, df) */
function tCritical(df, confidence) {
  const upperTail = (1 + confidence) / 2;
  return jStat.studentt.inv(upperTail, df);
}

/* Critical z value for a two-tailed CI at given confidence.
   R equivalent: qnorm(1 - (1-conf)/2) */
function zCritical(confidence) {
  const upperTail = (1 + confidence) / 2;
  return jStat.normal.inv(upperTail, 0, 1);
}

/* Critical z for a ONE-tailed test at significance level (1 − confidence).
   Uses upperTail = confidence rather than (1+confidence)/2.
   R equivalent: qnorm(confidence). */
function zCriticalOneTailed(confidence) {
  return jStat.normal.inv(confidence, 0, 1);
}

/* Given a t statistic, df, tail, and confidence, return the tail-aware
   p-value and the critical t to display (negative for a lower-tailed
   test). The CI does not use this value; CIs are always two-tailed. */
function tTestPandCrit(t, df, tail, confidence) {
  let p, tCrit;
  if (tail === "upper") {
    p = tPvalueUpper(t, df);
    tCrit = tCriticalOneTailed(df, confidence);
  } else if (tail === "lower") {
    p = tPvalueLower(t, df);
    tCrit = -tCriticalOneTailed(df, confidence);
  } else {
    p = tPvalueTwoTailed(t, df);
    tCrit = tCritical(df, confidence);
  }
  return { p, tCrit };
}

/* ============================================================
   SECTION 3: DESCRIPTIVE STATISTICS

   Given a single numeric vector, compute the standard battery
   of descriptive statistics. Returns an object with everything
   we want to display.
   ============================================================ */
function descriptives(data) {
  const n = data.length;
  const m = mean(data);
  const sorted = sortedCopy(data);
  const sd_sample = sampleSD(data);
  const sd_pop = populationSD(data);

  // Median. If n is even, average the two middle values.
  const median = n % 2 === 0
    ? (sorted[n/2 - 1] + sorted[n/2]) / 2
    : sorted[(n - 1) / 2];

  // Mode. There can be more than one, so we return an array.
  // If every value is unique, there's technically no mode.
  const counts = {};
  data.forEach(x => {
    counts[x] = (counts[x] || 0) + 1;
  });
  const maxCount = Math.max(...Object.values(counts));
  const modes = maxCount > 1
    ? Object.keys(counts)
        .filter(k => counts[k] === maxCount)
        .map(Number)
        .sort((a, b) => a - b)
    : [];  // empty array = no mode

  // Min, max, range
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;

  return {
    n,
    mean: m,
    median,
    modes,  // array; empty if no mode
    sd_sample,
    sd_pop,
    variance_sample: sd_sample ** 2,
    variance_pop: sd_pop ** 2,
    min,
    max,
    range
  };
}


/* ============================================================
   SECTION 4: PEARSON CORRELATION

   Computes r, tests H0: rho = 0, and constructs a CI for rho
   using Fisher's z transformation.
   ============================================================ */
function correlation(x, y, confidence) {
  if (confidence === undefined) confidence = 0.95;

  const n = x.length;
  const mx = mean(x);
  const my = mean(y);

  // Sum of cross-products of deviations
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  // Pearson r
  const r = sxy / Math.sqrt(sxx * syy);
  const r2 = r * r;

  // Test H0: rho = 0
  // t = r * sqrt((n-2) / (1 - r^2)), df = n - 2
  const df = n - 2;
  const t = r * Math.sqrt(df / (1 - r2));
  const p = tPvalueTwoTailed(t, df);

  // Confidence interval via Fisher's z transformation
  // z = 0.5 * ln((1+r)/(1-r))
  // z has approximate SE = 1/sqrt(n-3)
  // Transform CI endpoints back to r units
  const zr = 0.5 * Math.log((1 + r) / (1 - r));
  const seZ = 1 / Math.sqrt(n - 3);
  const zcrit = zCritical(confidence);
  const zLower = zr - zcrit * seZ;
  const zUpper = zr + zcrit * seZ;
  // Inverse Fisher: r = (e^(2z) - 1) / (e^(2z) + 1)
  const rLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
  const rUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);

  return {
    r,
    r2,
    n,
    t,
    df,
    p,
    ciLower: rLower,
    ciUpper: rUpper,
    confidence
  };
}


/* ============================================================
   SECTION 5: Z-TEST

   Tests H0: mu = mu0 when the population SD (sigma) is known.
   Two entry points: from raw data or from summary stats.
   ============================================================ */

function zTestFromSummary(xbar, mu0, sigma, n, confidence, tail) {
  if (confidence === undefined) confidence = 0.95;
  if (tail === undefined) tail = 'two';

  const se = sigma / Math.sqrt(n);
  const z = (xbar - mu0) / se;

  // Tail-aware p-value.
  let p;
  if (tail === "upper") {
    p = zPvalueUpper(z);
  } else if (tail === "lower") {
    p = zPvalueLower(z);
  } else {
    p = zPvalueTwoTailed(z);
  }

  // CI is always two-tailed, regardless of the test's tail.
  const zCI = zCritical(confidence);
  const ciLower = xbar - zCI * se;
  const ciUpper = xbar + zCI * se;

  const cohenD = (xbar - mu0) / sigma;

  return {
    xbar, mu0, sigma, n, se, z, p,
    zCrit: zcrit,
    tail,
    ciLower, ciUpper,
    cohenD,
    confidence
  };
}

function zTest(data, mu0, sigma, confidence, tail) {
  const xbar = mean(data);
  const n = data.length;
  return zTestFromSummary(xbar, mu0, sigma, n, confidence, tail);
}

/* ============================================================
   SECTION 6: COHEN'S D (STANDALONE)

   d = (M − μ) / SD, where SD is σ (population) or s (sample).
   The formula is the same either way; the UI labels the source.
   ============================================================ */
function cohensD(m, mu, sd) {
  return (m - mu) / sd;
}

/* ============================================================
   SECTION 7: ONE-SAMPLE T-TEST

   Tests H0: mu = mu0 when population SD is unknown.
   ============================================================ */

function oneSampleTTestFromSummary(xbar, s, n, mu0, confidence, tail) {
  if (confidence === undefined) confidence = 0.95;
  if (tail === undefined) tail = 'two';

  const se = s / Math.sqrt(n);
  const df = n - 1;
  const t = (xbar - mu0) / se;

  // Tail-aware p-value and the critical t to display.
  const { p, tCritSigned } = tTestPandCrit(t, df, tail, confidence);

  // CI is always two-tailed, regardless of the test's tail.
  const tCI = tCritical(df, confidence);
  const ciLower = xbar - tCI * se;
  const ciUpper = xbar + tCI * se;

  // Cohen's d = (xbar - mu0) / s
  const cohenD = (xbar - mu0) / s;

  return {
    xbar, s, n, se, df, t, p,
    tCrit: tCritSigned,
    tail,
    ciLower, ciUpper,
    cohenD,
    confidence
  };
}

function oneSampleTTest(data, mu0, confidence, tail) {
  const xbar = mean(data);
  const s = sampleSD(data);
  const n = data.length;
  return oneSampleTTestFromSummary(xbar, s, n, mu0, confidence, tail);
}


/* ============================================================
   SECTION 8: PAIRED-SAMPLE T-TEST

   Tests H0: mu_D = mu_D0 (usually 0) where D = X2 - X1
   (Measurement 2 minus Measurement 1).

   Uses Cohen's d_z:  d = mean_D / SD_D
   This is what PSYC 210 uses. The UI labels it "Cohen's d".
   ============================================================ */

function pairedTTestFromSummary(meanD, sdD, n, muD0, confidence, tail) {
  if (confidence === undefined) confidence = 0.95;
  if (muD0 === undefined) muD0 = 0;
  if (tail === undefined) tail = 'two';

  const se = sdD / Math.sqrt(n);
  const df = n - 1;
  const t = (meanD - muD0) / se;
  
  // Tail-aware p-value and the critical t to display.
  const { p, tCritSigned } = tTestPandCrit(t, df, tail, confidence);

  // CI is always two-tailed, regardless of the test's tail.
  const tCI = tCritical(df, confidence);
  const ciLower = meanD - tCI * se;
  const ciUpper = meanD + tCI * se;

  // Cohen's d = mean_D / SD_D  (labeled simply "Cohen's d" in the UI)
  const cohenD = meanD / sdD;

  return {
    meanD, sdD, n, se, df, t, p,
    tCrit: tCritSigned,
    tail,
    ciLower, ciUpper,
    cohenD,
    confidence
  };
}

function pairedTTest(x1, x2, muD0, confidence, tail) {
  if (x1.length !== x2.length) {
    throw new Error('Paired data must have equal lengths');
  }
  // Difference scores: Measurement 2 − Measurement 1 (textbook convention)
  const diffs = x2.map((v, i) => v - x1[i]);
  const meanD = mean(diffs);
  const sdD = sampleSD(diffs);
  const n = diffs.length;
  return pairedTTestFromSummary(meanD, sdD, n, muD0, confidence, tail);
}


/* ============================================================
   SECTION 9: INDEPENDENT-SAMPLE T-TEST (POOLED)

   PSYC 210 uses the POOLED VARIANCE approach.

   Pooled SD:  s_p = sqrt(((n1-1)*s1^2 + (n2-1)*s2^2) / (n1+n2-2))
   SE:         s_p * sqrt(1/n1 + 1/n2)
   t:          (xbar1 - xbar2) / SE
   df:         n1 + n2 - 2
   Cohen's d:  (xbar1 - xbar2) / s_p
   ============================================================ */

function independentTTestFromSummary(
  xbar1, s1, n1, xbar2, s2, n2, confidence, tail
) {
  if (confidence === undefined) confidence = 0.95;
  if (tail === undefined) tail = 'two';

  const df = n1 + n2 - 2;
  // Pooled variance and SD
  const pooledVar = ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / df;
  const sp = Math.sqrt(pooledVar);
  const se = sp * Math.sqrt(1/n1 + 1/n2);

  const meanDiff = xbar1 - xbar2;
  const t = meanDiff / se;
  
  // Tail-aware p-value and the critical t to display.
  const { p, tCritSigned } = tTestPandCrit(t, df, tail, confidence);

  // CI is always two-tailed, regardless of the test's tial. 
  const ciLower = meanDiff - tCI * se;
  const ciUpper = meanDiff + tCI * se;

  // Cohen's d using pooled SD
  const cohenD = meanDiff / sp;

  return {
    xbar1, s1, n1,
    xbar2, s2, n2,
    meanDiff, sp, se, df, t, p,
    tCrit: tCritSigned,
    tail,
    ciLower, ciUpper,
    cohenD,
    confidence
  };
}

function independentTTest(x1, x2, confidence, tail) {
  const xbar1 = mean(x1);
  const s1 = sampleSD(x1);
  const n1 = x1.length;
  const xbar2 = mean(x2);
  const s2 = sampleSD(x2);
  const n2 = x2.length;
  return independentTTestFromSummary(
    xbar1, s1, n1, xbar2, s2, n2, confidence, tail
  );
}


/* ============================================================
   SECTION 10: ONE-WAY BETWEEN-GROUPS ANOVA

   Compares means across k independent groups.

   PSYC 210 uses eta-squared (η²) as the effect size.

   Grand mean = weighted average of group means.
   SS_between = sum over groups of n_g * (mean_g - grand_mean)^2
   SS_within  = sum over groups of (n_g - 1) * s_g^2
   SS_total   = SS_between + SS_within

   df_between = k - 1
   df_within  = N - k

   MS_between = SS_between / df_between
   MS_within  = SS_within  / df_within

   F          = MS_between / MS_within
   eta^2      = SS_between / SS_total

   The confidence argument is passed through unused here; the
   Tukey HSD step uses it for its CIs.
   ============================================================ */

function anovaFromSummary(groups, confidence) {
  // groups is an array of {mean, sd, n, name?}
  if (confidence === undefined) confidence = 0.95;

  const k = groups.length;
  const N = groups.reduce((sum, g) => sum + g.n, 0);

  // Grand mean (weighted by group sizes)
  const grandMean = groups.reduce((sum, g) => sum + g.mean * g.n, 0) / N;

  // Sums of squares
  const ssBetween = groups.reduce(
    (sum, g) => sum + g.n * (g.mean - grandMean) ** 2,
    0
  );
  const ssWithin = groups.reduce(
    (sum, g) => sum + (g.n - 1) * g.sd * g.sd,
    0
  );
  const ssTotal = ssBetween + ssWithin;

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const dfTotal = N - 1;

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  const F = msBetween / msWithin;
  const p = fPvalue(F, dfBetween, dfWithin);

  // Effect sizes
  const etaSquared = ssBetween / ssTotal;

  return {
    k, N, grandMean,
    groups,
    ssBetween, ssWithin, ssTotal,
    dfBetween, dfWithin, dfTotal,
    msBetween, msWithin,
    F, p,
    etaSquared,
    confidence
  };
}

function anova(groupsData, confidence) {
  // groupsData is an array of {name?, data: [numbers]}
  const summary = groupsData.map(g => ({
    name: g.name,
    mean: mean(g.data),
    sd: sampleSD(g.data),
    n: g.data.length
  }));
  return anovaFromSummary(summary, confidence);
}

/* ============================================================
   SECTION 11: TUKEY HSD POST-HOC COMPARISONS

   Tukey's Honestly Significant Difference test identifies WHICH
   pairs of groups differ, while controlling the family-wise error
   rate across all comparisons. The app shows it after every raw-data
   ANOVA, whether or not the omnibus F is significant.

   Raw data only: this implementation takes the underlying
   observations. jStat.tukeyhsd supplies the p-values; we compute
   MS within and the critical studentized range value (jStat.tukey.inv)
   for the CIs, and attach names and mean differences for display.

   CI margin:  (q_crit / sqrt(2)) * sqrt(MS_within * (1/n_i + 1/n_j))

   Input:  groupsData — array of {name?, data: [numbers]}
           confidence — CI level (default 0.95)
   Output: array of { pair, meanDiff, ciLower, ciUpper, p, significant }
           objects, one per unique group pair. significant uses p < .05.
   ============================================================ */
function tukeyHSD(groupsData, confidence) {
  if (confidence === undefined) confidence = 0.95;

  const dataArrays = groupsData.map((g) => g.data);
  const names = groupsData.map((g, i) => g.name || `Group ${i + 1}`);

  // MS within and the critical studentized range value
  const k = dataArrays.length;
  const N = dataArrays.reduce((sum, d) => sum + d.length, 0);
  const ssWithin = dataArrays.reduce((sum, d) => sum + sumOfSquares(d), 0);
  const msWithin = ssWithin / (N - k);
  const qCrit = jStat.tukey.inv(confidence, k, N - k);

  const raw = jStat.tukeyhsd(dataArrays);

  return raw.map(([[i, j], p]) => {
    const meanDiff = mean(dataArrays[i]) - mean(dataArrays[j]);
    const ni = dataArrays[i].length;
    const nj = dataArrays[j].length;
    const margin =
      (qCrit / Math.SQRT2) * Math.sqrt(msWithin * (1 / ni + 1 / nj));
    return {
      pair: `${names[i]} − ${names[j]}`,
      meanDiff,
      ciLower: meanDiff - margin,
      ciUpper: meanDiff + margin,
      p,
      significant: p < 0.05,
    };
  });
}