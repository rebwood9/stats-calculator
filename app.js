/* ============================================================
   app.js
   ============================================================
   PAGE BEHAVIOR.

   This file connects the HTML to the math in stats.js.
   Organization:

     Section 1: Formatting helpers (numbers, p-values)
     Section 2: Tab switching
     Section 3: Mode toggles (raw vs summary)
     Section 4: Individual calculator handlers, one per tab
                4a. Descriptives
                4b. Correlation
                4c. z-test
                4d. One-sample t
                4e. Paired-sample t
                4f. Independent-sample t
                4g. ANOVA (with dynamic group add/remove)
     Section 5: Reusable rendering helpers

   Every calculator follows the same 4-step pattern:
     1. Read inputs from the form
     2. Validate (show error and stop if invalid)
     3. Call the stats function from stats.js
     4. Render results into the results div --> 2026-07-30 modified to remove interpretation 
   ============================================================ */


/* ============================================================
   SECTION 1: FORMATTING HELPERS
   ============================================================ */

/* Format a number for display. Handles edge cases:
   - Non-finite (Infinity, NaN) → em dash
   - Very small non-zero → scientific notation
   - Otherwise → fixed decimal places */
function formatNum(n, digits) {
  if (digits === undefined) digits = 3;
  if (!isFinite(n)) return '—';
  if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2);
  return n.toFixed(digits);
}

/* APA-style p-value:
     p < .001            → "< .001"
     otherwise           → three decimals with no leading zero */
function formatPValue(p) {
  if (p < 0.001) return '< .001';
  return p.toFixed(3).replace(/^0/, '');
}

/* Build the "p = ..." or "p < ..." string for interpretation prose. */
function pWithEquals(p) {
  const s = formatPValue(p);
  return s.startsWith('<') ? s : '= ' + s;
}


/* ============================================================
   SECTION 2: TAB SWITCHING

   Attach ONE listener to the parent nav element and check which
   button was clicked. This "event delegation" pattern is cleaner
   than attaching seven separate listeners.
   ============================================================ */

document.getElementById('tabs').addEventListener('click', function(event) {
  const clicked = event.target.closest('.tab');
  // ^ .closest() walks up from event.target until it finds an
  //   element matching the selector, or returns null. This handles
  //   the case where the user clicked the counter span or the em
  //   tag INSIDE the button rather than the button itself.
  if (!clicked) return;

  // Which panel does this tab control?
  const targetPanelId = clicked.dataset.panel;

  // Remove .active from all tabs and panels, then add to the ones we want.
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  clicked.classList.add('active');
  document.getElementById(targetPanelId).classList.add('active');
});

/* ============================================================
   SECTION 3a: TAIL TOGGLES

   Wire up a tail-selection toggle (two-tailed / one-tailed upper /
   one-tailed lower). Same click-to-activate behavior as the mode
   toggle, but for choosing the alternative hypothesis direction.
   Reused across the z-test and t-tests.
   
   ============================================================ */

function wireTailToggle(toggleId) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;
  toggle.addEventListener('click', function(event) {
    const btn = event.target.closest('button');
    if (!btn) return;
    toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
}

/* Read the currently selected tail ('two', 'upper', or 'lower')
   from a tail toggle. Defaults to 'two' if none is active. */
function getTail(toggleId) {
  const activeBtn = document.querySelector(`#${toggleId} button.active`);
  return activeBtn ? activeBtn.dataset.tail : 'two';
}

// Wire all tail toggles (z-test and the three t-tests).
['z-tail', 't1-tail', 'tp-tail', 'ti-tail'].forEach(wireTailToggle);

/* ============================================================
   SECTION 3b: MODE TOGGLES (Raw vs Summary)

   Every calculator that has a mode toggle uses the same
   naming convention:
     - Toggle container:   {prefix}-mode
     - Raw input section:  {prefix}-raw
     - Summary section:    {prefix}-summary

   So we can wire them all up with a single helper.
   ============================================================ */

function wireModeToggle(prefix) {
  const toggle = document.getElementById(prefix + '-mode');
  if (!toggle) return;
  // ^ Return quietly if this prefix doesn't have a mode toggle
  //   (e.g., descriptives, correlation).

  toggle.addEventListener('click', function(event) {
    const btn = event.target.closest('button');
    if (!btn) return;

    // Mark this button as active, others as inactive
    toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show/hide the corresponding input sections
    const mode = btn.dataset.mode;
    const rawSection = document.getElementById(prefix + '-raw');
    const sumSection = document.getElementById(prefix + '-summary');
    if (mode === 'raw') {
      rawSection.style.display = 'block';
      sumSection.style.display = 'none';
    } else {
      rawSection.style.display = 'none';
      sumSection.style.display = 'block';
    }

    // Clear previous results/errors when switching modes
    clearOutputs(prefix);
  });
}

// Wire up every calculator's mode toggle at once
['z', 't1', 'tp', 'ti', 'av'].forEach(wireModeToggle);


/* Get current mode ('raw' or 'summary') for a calculator. */
function getMode(prefix) {
  const activeBtn = document
    .querySelector(`#${prefix}-mode button.active`);
  return activeBtn ? activeBtn.dataset.mode : 'raw';
}

/* Clear results and error for a given calculator. */
function clearOutputs(prefix) {
  const errEl = document.getElementById(prefix + '-error');
  const resEl = document.getElementById(prefix + '-results');
  if (errEl) errEl.textContent = '';
  if (resEl) resEl.innerHTML = '';
}

/* Show an error message for a given calculator. */
function showError(prefix, message) {
  document.getElementById(prefix + '-error').textContent = message;
  document.getElementById(prefix + '-results').innerHTML = '';
}


/* ============================================================
   SECTION 4a: DESCRIPTIVE STATISTICS
   ============================================================ */

document.getElementById('desc-calc').addEventListener('click', function() {
  clearOutputs('desc');

  const data = parseDataString(document.getElementById('desc-data').value);
  if (data.length < 2) {
    showError('desc', 'Please enter at least 2 numeric values.');
    return;
  }

  // Which statistics did the student check? Read the data-stat
  // attribute off every checked box in the options grid.
  const selected = Array.from(
    document.querySelectorAll('#desc-options input:checked')
  ).map(box => box.dataset.stat);

  if (selected.length === 0) {
    showError('desc', 'Please select at least one statistic to display.');
    return;
  }

  const r = descriptives(data);

  // Build the mode display string. Empty array = no mode.
  const modeStr = r.modes.length === 0
    ? 'None'
    : r.modes.map(m => formatNum(m, 2)).join(', ');

  // Map each selectable stat to its [label, value] pair. Only the
  // keys present here can be displayed; the handler picks from this
  // based on what's checked.
  const allCells = {
    n:               ['n', r.n],
    mean:            ['Mean', formatNum(r.mean)],
    median:          ['Median', formatNum(r.median)],
    mode:            ['Mode', modeStr],
    sd_sample:       ['SD (sample, n−1)', formatNum(r.sd_sample)],
    sd_pop:          ['SD (population, n)', formatNum(r.sd_pop)],
    variance_sample: ['Variance (n−1)', formatNum(r.variance_sample)],
    variance_pop:    ['Variance (n)', formatNum(r.variance_pop)],
    min:             ['Min', formatNum(r.min)],
    max:             ['Max', formatNum(r.max)],
    range:           ['Range', formatNum(r.range)]
  };

  // Keep the display order fixed (the order of allCells' keys),
  // regardless of the order boxes were clicked.
  const cells = Object.keys(allCells)
    .filter(key => selected.includes(key))
    .map(key => allCells[key]);

  renderResults('desc', cells);
});


/* ============================================================
   SECTION 4b: CORRELATION
   ============================================================ */

document.getElementById('corr-calc').addEventListener('click', function() {
  clearOutputs('corr');

  const x = parseDataString(document.getElementById('corr-x').value);
  const y = parseDataString(document.getElementById('corr-y').value);

  if (x.length < 3 || y.length < 3) {
    showError('corr',
      'Please enter at least 3 values for each variable.');
    return;
  }
  if (x.length !== y.length) {
    showError('corr',
      `Variables must have the same number of values (found ${x.length} for X, ${y.length} for Y).`);
    return;
  }

  let confidence = parseFloat(document.getElementById('corr-conf').value);
  if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

  const r = correlation(x, y, confidence);
  const confPct = (r.confidence * 100).toFixed(0);
  const sig = r.p < 0.05;

  const cells = [
    ['r', formatNum(r.r), sig],
    ['r²', formatNum(r.r2)],
    ['n', r.n],
    ['t', formatNum(r.t)],
    ['df', r.df],
    ['p', formatPValue(r.p), sig],
    [`${confPct}% CI for r`,
     `[${formatNum(r.ciLower)}, ${formatNum(r.ciUpper)}]`]
  ];

  renderResults('corr', cells);
});


/* ============================================================
   SECTION 4c: Z-TEST
   ============================================================ */

document.getElementById('z-calc').addEventListener('click', function() {
  clearOutputs('z');
  const mode = getMode('z');
  const tail = getTail('z-tail');
  let result;

  if (mode === 'summary') {
    const xbar = parseFloat(document.getElementById('z-mean').value);
    const n = parseInt(document.getElementById('z-n').value);
    const mu0 = parseFloat(document.getElementById('z-mu-sum').value);
    const sigma = parseFloat(document.getElementById('z-sigma-sum').value);
    let confidence = parseFloat(document.getElementById('z-conf-sum').value);

    if (isNaN(xbar)) return showError('z', 'Enter the sample mean.');
    if (isNaN(n) || n < 1) return showError('z', 'Enter a valid sample size.');
    if (isNaN(mu0)) return showError('z', 'Enter the hypothesized mean.');
    if (isNaN(sigma) || sigma <= 0) return showError('z', 'Enter a positive σ.');
    if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

    result = zTestFromSummary(xbar, mu0, sigma, n, confidence, tail);
  } else {
    const data = parseDataString(document.getElementById('z-data').value);
    const mu0 = parseFloat(document.getElementById('z-mu-raw').value);
    const sigma = parseFloat(document.getElementById('z-sigma-raw').value);
    let confidence = parseFloat(document.getElementById('z-conf-raw').value);

    if (data.length < 1) return showError('z', 'Enter at least one value.');
    if (isNaN(mu0)) return showError('z', 'Enter the hypothesized mean.');
    if (isNaN(sigma) || sigma <= 0) return showError('z', 'Enter a positive σ.');
    if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

    result = zTest(data, mu0, sigma, confidence, tail);
  }

  const confPct = (result.confidence * 100).toFixed(0);
  const sig = result.p < 0.05;

  // Human-readable label for the p-value's tail.
  const tailLabel = result.tail === 'upper' ? 'one-tailed (>)'
                  : result.tail === 'lower' ? 'one-tailed (<)'
                  : 'two-tailed';

  const cells = [
    ['x̄', formatNum(result.xbar)],
    ['μ', formatNum(result.mu0)],
    ['σ', formatNum(result.sigma)],
    ['n', result.n],
    ['SE', formatNum(result.se)],
    ['z', formatNum(result.z), sig],
    [`p (${tailLabel})`, formatPValue(result.p), sig],
    [`${confPct}% CI for mean`,
     `[${formatNum(result.ciLower)}, ${formatNum(result.ciUpper)}]`],
    ["Cohen's d", formatNum(result.cohenD)]
  ];
  
  renderResults('z', cells);
});


/* ============================================================
   SECTION 4d: ONE-SAMPLE T-TEST
   ============================================================ */

document.getElementById('t1-calc').addEventListener('click', function() {
  clearOutputs('t1');
  const mode = getMode('t1');
  const tail = getTail('t1-tail');
  let result;

  if (mode === 'raw') {
    const data = parseDataString(document.getElementById('t1-data').value);
    const mu0 = parseFloat(document.getElementById('t1-mu-raw').value);
    let confidence = parseFloat(document.getElementById('t1-conf-raw').value);

    if (data.length < 2) return showError('t1', 'Enter at least 2 values.');
    if (isNaN(mu0)) return showError('t1', 'Enter the hypothesized mean (μ₀).');
    if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

    result = oneSampleTTest(data, mu0, confidence, tail);
  } else {
    const xbar = parseFloat(document.getElementById('t1-mean').value);
    const s = parseFloat(document.getElementById('t1-sd').value);
    const n = parseInt(document.getElementById('t1-n').value);
    const mu0 = parseFloat(document.getElementById('t1-mu-sum').value);
    let confidence = parseFloat(document.getElementById('t1-conf-sum').value);

    if (isNaN(xbar)) return showError('t1', 'Enter the sample mean.');
    if (isNaN(s) || s <= 0) return showError('t1', 'Enter a positive SD.');
    if (isNaN(n) || n < 2) return showError('t1', 'Sample size must be at least 2.');
    if (isNaN(mu0)) return showError('t1', 'Enter the hypothesized mean.');
    if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

    result = oneSampleTTestFromSummary(xbar, s, n, mu0, confidence, tail);
  }

  const confPct = (result.confidence * 100).toFixed(0);
  const sig = result.p < 0.05;

  const tailLabel = result.tail === 'upper' ? 'one-tailed (>)'
                  : result.tail === 'lower' ? 'one-tailed (<)'
                  : 'two-tailed';

  const cells = [
    ['x̄', formatNum(result.xbar)],
    ['s', formatNum(result.s)],
    ['n', result.n],
    ['SE', formatNum(result.se)],
    ['t', formatNum(result.t), sig],
    ['df', result.df],
    ['t crit', formatNum(result.tCrit)],
    [`p (${tailLabel})`, formatPValue(result.p), sig],
    ["Cohen's d", formatNum(result.cohenD)]
  ];

  renderResults('t1', cells);
});


/* ============================================================
   SECTION 4e: PAIRED-SAMPLE T-TEST
   ============================================================ */

document.getElementById('tp-calc').addEventListener('click', function() {
  clearOutputs('tp');
  const mode = getMode('tp');
  const tail = getTail('tp-tail');
  let result;

  if (mode === 'raw') {
    const x1 = parseDataString(document.getElementById('tp-x1').value);
    const x2 = parseDataString(document.getElementById('tp-x2').value);
    const muD0 = parseFloat(document.getElementById('tp-mu-raw').value);
    let confidence = parseFloat(document.getElementById('tp-conf-raw').value);

    if (x1.length < 2 || x2.length < 2) {
      return showError('tp', 'Enter at least 2 pairs of values.');
    }
    if (x1.length !== x2.length) {
      return showError('tp',
        `Measurement columns must be equal length (${x1.length} vs ${x2.length}).`);
    }
    if (isNaN(muD0)) return showError('tp', 'Enter the hypothesized mean difference.');
    if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

    result = pairedTTest(x1, x2, muD0, confidence, tail);
  } else {
    const meanD = parseFloat(document.getElementById('tp-mean-d').value);
    const sdD = parseFloat(document.getElementById('tp-sd-d').value);
    const n = parseInt(document.getElementById('tp-n').value);
    const muD0 = parseFloat(document.getElementById('tp-mu-sum').value);
    let confidence = parseFloat(document.getElementById('tp-conf-sum').value);

    if (isNaN(meanD)) return showError('tp', 'Enter the mean of differences.');
    if (isNaN(sdD) || sdD <= 0) return showError('tp', 'Enter a positive SD of differences.');
    if (isNaN(n) || n < 2) return showError('tp', 'n must be at least 2.');
    if (isNaN(muD0)) return showError('tp', 'Enter the hypothesized mean difference.');
    if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

    result = pairedTTestFromSummary(meanD, sdD, n, muD0, confidence, tail);
  }

  const confPct = (result.confidence * 100).toFixed(0);
  const sig = result.p < 0.05;
  
  const tailLabel = result.tail === 'upper' ? 'one-tailed (>)'
                  : result.tail === 'lower' ? 'one-tailed (<)'
                  : 'two-tailed';

  const cells = [
    ['D̄ (mean diff)', formatNum(result.meanD)],
    ['s_D', formatNum(result.sdD)],
    ['n (pairs)', result.n],
    ['SE', formatNum(result.se)],
    ['t', formatNum(result.t), sig],
    ['df', result.df],
    ['t crit', formatNum(result.tCrit)],
    [`p (${tailLabel})`, formatPValue(result.p), sig],
    ["Cohen's d", formatNum(result.cohenD)]
  ];

  renderResults('tp', cells);
});


/* ============================================================
   SECTION 4f: INDEPENDENT-SAMPLE T-TEST (POOLED)
   ============================================================ */

document.getElementById('ti-calc').addEventListener('click', function() {
  clearOutputs('ti');
  const mode = getMode('ti');
  const tail = getTail('ti-tail');
  let confidence = parseFloat(document.getElementById('ti-conf').value);
  if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

  let result;

  if (mode === 'raw') {
    const x1 = parseDataString(document.getElementById('ti-x1').value);
    const x2 = parseDataString(document.getElementById('ti-x2').value);

    if (x1.length < 2 || x2.length < 2) {
      return showError('ti', 'Enter at least 2 values in each group.');
    }
    result = independentTTest(x1, x2, confidence, tail);
  } else {
    const xbar1 = parseFloat(document.getElementById('ti-mean1').value);
    const xbar2 = parseFloat(document.getElementById('ti-mean2').value);
    const s1 = parseFloat(document.getElementById('ti-sd1').value);
    const s2 = parseFloat(document.getElementById('ti-sd2').value);
    const n1 = parseInt(document.getElementById('ti-n1').value);
    const n2 = parseInt(document.getElementById('ti-n2').value);

    if (isNaN(xbar1) || isNaN(xbar2)) return showError('ti', 'Enter both group means.');
    if (isNaN(s1) || s1 <= 0 || isNaN(s2) || s2 <= 0) {
      return showError('ti', 'Enter positive SDs for both groups.');
    }
    if (isNaN(n1) || n1 < 2 || isNaN(n2) || n2 < 2) {
      return showError('ti', 'Each group must have n ≥ 2.');
    }
    result = independentTTestFromSummary(xbar1, s1, n1, xbar2, s2, n2, confidence, tail);
  }

  const confPct = (result.confidence * 100).toFixed(0);
  const sig = result.p < 0.05;

  const tailLabel = result.tail === 'upper' ? 'one-tailed (>)'
                  : result.tail === 'lower' ? 'one-tailed (<)'
                  : 'two-tailed';
                  
  const cells = [
    ['x̄₁', formatNum(result.xbar1)],
    ['x̄₂', formatNum(result.xbar2)],
    ['s₁', formatNum(result.s1)],
    ['s₂', formatNum(result.s2)],
    ['n₁', result.n1],
    ['n₂', result.n2],
    ['x̄₁ − x̄₂', formatNum(result.meanDiff)],
    ['Pooled SD', formatNum(result.sp)],
    ['SE', formatNum(result.se)],
    ['t', formatNum(result.t), sig],
    ['df', result.df],
    ['t crit', formatNum(result.tCrit)],
    [`p (${tailLabel})`, formatPValue(result.p), sig],
    ["Cohen's d", formatNum(result.cohenD)]
  ];

  renderResults('ti', cells);
});


/* ============================================================
   SECTION 4g: ONE-WAY BETWEEN-GROUPS ANOVA

   This one is more involved because we support a dynamic number
   of groups. First we wire up the add/remove buttons, then the
   calculate handler.
   ============================================================ */

/* Renumber all group labels after adding/removing.
   Keeps "Group 1", "Group 2", ... in sequence. */
function renumberGroups(containerId) {
  const container = document.getElementById(containerId);
  const rows = container.querySelectorAll('.group-row');
  rows.forEach((row, i) => {
    const idx = i + 1;
    row.dataset.groupIndex = idx;
    // Update the visible "Group N" labels
    row.querySelectorAll('label').forEach(lbl => {
      lbl.innerHTML = lbl.innerHTML.replace(
        /Group \d+/,
        'Group ' + idx
      );
    });
  });
}

/* Add a new group row by cloning the last one and clearing values. */
function addGroup(containerId, mode) {
  const container = document.getElementById(containerId);
  const rows = container.querySelectorAll('.group-row');
  if (rows.length >= 10) return;  // safety cap

  const lastRow = rows[rows.length - 1];
  const newRow = lastRow.cloneNode(true);
  // ^ deep clone: copies the row and all descendants

  // Clear all input/textarea values in the clone
  newRow.querySelectorAll('input, textarea').forEach(el => {
    el.value = '';
    el.removeAttribute('placeholder');
  });

  container.appendChild(newRow);
  renumberGroups(containerId);
}

/* Remove the last group row (but never go below 2). */
function removeGroup(containerId) {
  const container = document.getElementById(containerId);
  const rows = container.querySelectorAll('.group-row');
  if (rows.length <= 2) return;  // ANOVA needs at least 2 groups
  rows[rows.length - 1].remove();
  renumberGroups(containerId);
}

document.getElementById('av-raw-add').addEventListener('click',
  () => addGroup('av-raw-groups', 'raw'));
document.getElementById('av-raw-remove').addEventListener('click',
  () => removeGroup('av-raw-groups'));
document.getElementById('av-sum-add').addEventListener('click',
  () => addGroup('av-sum-groups', 'summary'));
document.getElementById('av-sum-remove').addEventListener('click',
  () => removeGroup('av-sum-groups'));

/* Read all group data from the raw-mode inputs. */
function readAnovaRawGroups() {
  const rows = document.querySelectorAll('#av-raw-groups .group-row');
  const groups = [];
  rows.forEach((row, i) => {
    const nameEl = row.querySelector('.av-raw-name');
    const dataEl = row.querySelector('.av-raw-data');
    const name = nameEl.value.trim() || `Group ${i + 1}`;
    const data = parseDataString(dataEl.value);
    if (data.length > 0) {
      groups.push({ name, data });
    }
  });
  return groups;
}

/* Read all group summaries from the summary-mode inputs. */
function readAnovaSummaryGroups() {
  const rows = document.querySelectorAll('#av-sum-groups .group-row');
  const groups = [];
  let anyIncomplete = false;
  rows.forEach((row, i) => {
    const name = row.querySelector('.av-sum-name').value.trim()
                 || `Group ${i + 1}`;
    const gmean = parseFloat(row.querySelector('.av-sum-mean').value);
    const gsd = parseFloat(row.querySelector('.av-sum-sd').value);
    const gn = parseInt(row.querySelector('.av-sum-n').value);

    // Skip rows that are entirely empty; flag partially filled rows
    const allEmpty = isNaN(gmean) && isNaN(gsd) && isNaN(gn);
    const allFilled = !isNaN(gmean) && !isNaN(gsd) && !isNaN(gn) && gsd > 0 && gn >= 2;
    if (allEmpty) return;
    if (!allFilled) {
      anyIncomplete = true;
      return;
    }
    groups.push({ name, mean: gmean, sd: gsd, n: gn });
  });
  return { groups, anyIncomplete };
}

document.getElementById('av-calc').addEventListener('click', function() {
  clearOutputs('av');
  const mode = getMode('av');
  let confidence = parseFloat(document.getElementById('av-conf').value);
  if (isNaN(confidence) || confidence <= 0 || confidence >= 1) confidence = 0.95;

  let result;

  if (mode === 'raw') {
    const groups = readAnovaRawGroups();
    if (groups.length < 2) {
      return showError('av', 'Enter data for at least 2 groups.');
    }
    if (groups.some(g => g.data.length < 2)) {
      return showError('av', 'Each group must have at least 2 values.');
    }
    result = anova(groups, confidence);
  } else {
    const { groups, anyIncomplete } = readAnovaSummaryGroups();
    if (anyIncomplete) {
      return showError('av',
        'Each group needs a mean, positive SD, and n ≥ 2 (or leave the row entirely blank).');
    }
    if (groups.length < 2) {
      return showError('av', 'Enter summary stats for at least 2 groups.');
    }
    result = anovaFromSummary(groups, confidence);
  }

  const sig = result.p < 0.05;

  // Build the main results grid
  // One cell per group mean, labeled by group name.
  const groupMeanCells = result.groups.map(g =>
    [`${g.name} mean`, formatNum(g.mean)]
  );

  const cells = [
    ['k (groups)', result.k],
    ['N (total)', result.N],
    ...groupMeanCells,
    ['SS between', formatNum(result.ssBetween, 2)],
    ['SS within', formatNum(result.ssWithin, 2)],
    ['SS total', formatNum(result.ssTotal, 2)],
    ['df between', result.dfBetween],
    ['df within', result.dfWithin],
    ['MS between', formatNum(result.msBetween, 2)],
    ['MS within', formatNum(result.msWithin, 2)],
    ['F', formatNum(result.F), sig],
    ['p', formatPValue(result.p), sig],
    ['η² (eta-squared)', formatNum(result.etaSquared)]
  ];

  renderResults('av', cells);
});


/* ============================================================
   SECTION 5: RESULT RENDERING HELPERS
   ============================================================ */

/* Render a set of result cells.
   cells is an array of [label, value] or [label, value, isSignificant]. */
function renderResults(prefix, cells) {
  const resultsHTML = `
    <h3>Results</h3>
    <div class="result-grid">
      ${cells.map(([label, value, sig]) => `
        <div class="result-cell">
          <div class="result-label">${label}</div>
          <div class="result-value${sig ? ' significant' : ''}">${value}</div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById(prefix + '-results').innerHTML = resultsHTML;
}
