# PSYC 210 Statistical Calculator

A browser-based statistical calculator built as a supplementary teaching tool for PSYC 210, an introductory statistics course at the University of Kansas.

**Live site:** https://rebwood9.github.io/stats-calculator/

The tool runs entirely in the browser. There is nothing to install, and it works on desktop and mobile.

## Calculators

| Tab                  | Input modes                        | Reports                                                   |
| -------------------- | ---------------------------------- | --------------------------------------------------------- |
| Descriptives         | Raw data                           | Choose from n, mean, median, mode, SD, variance, min, max, range |
| Correlation          | Raw data                           | r, R², t, df, p, CI for r                                 |
| z-Test               | Summary stats (default), raw data  | SE, z, p, CI for mean, Cohen's d                          |
| Cohen's d            | Population (σ), sample (s)         | Cohen's d                                                 |
| Single-Sample t      | Raw data (default), summary stats  | SE, t, df, t crit, p, CI for mean, Cohen's d              |
| Paired t             | Raw data (default), summary stats  | SE, t, df, t crit, p, CI for M_diff, Cohen's d            |
| Independent t        | Raw data (default), summary stats  | Pooled SD, SE, t, df, t crit, p, CI for M₁ − M₂, Cohen's d |
| One-Way ANOVA        | Raw data (default), summary stats  | SS, df, MS, F, p, η², group means, Tukey HSD (raw mode)   |

The z-test and all three t-tests include a tail toggle (two-tailed, one-tailed >, one-tailed <). Confidence intervals use the critical value that matches the chosen tail.

## Conventions

The calculator follows PSYC 210 conventions and leaves out options the course doesn't cover.

- The independent t-test uses pooled variance. Welch's correction is intentionally not offered.
- Paired differences are Measurement 2 − Measurement 1. Cohen's d for the paired test is d_z (M_diff / s_diff).
- Independent t differences are Group 1 − Group 2.
- ANOVA reports η² as the effect size.
- Results are shown without interpretation text, and significant results are not highlighted. Students interpret the output on their own.

## Files

```
stats-calculator/
├── index.html   Page structure and all eight calculator tabs
├── styles.css   Visual design (KU color palette)
├── stats.js     Statistical functions, no HTML dependencies
└── app.js       Connects the form inputs to the functions in stats.js
```

The only dependency is [jStat](https://jstat.github.io/) 1.9.6, loaded from a CDN, which supplies the distribution functions.

## Running locally

Download or clone the repository and open `index.html` in a browser. An internet connection is needed the first time so jStat can load from the CDN.

## Reporting issues

Bug reports and incorrect calculations can be filed on the [issue tracker](https://github.com/rebwood9/stats-calculator/issues). Students can also email woodr@ku.edu.

## Credits

Created by Rebecca Wood, with assistance from AI coding tools. Statistical distributions are computed with jStat (MIT licensed).

© 2026 Rebecca Wood
