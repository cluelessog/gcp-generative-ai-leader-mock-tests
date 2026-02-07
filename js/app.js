/* Dashboard - Load mocks, render test cards, link to exam/results */

(function() {
  var cachedMocks = [];

  function renderTestCards(mocks, results) {
    var grid = document.getElementById('testGrid');
    if (!grid || !mocks || !mocks.length) return;

    var html = '';
    mocks.forEach(function(mock) {
      var mockId = mock.mockId;
      var inProgress = StorageManager.isExamInProgress(mockId);
      var result = results[mockId];
      var statusHtml = '';
      var scoreHtml = '';
      var actionHtml = '';

      if (inProgress) {
        var state = StorageManager.loadExamState(mockId);
        var answeredCount = state && state.answers ? Object.keys(state.answers).length : 0;
        statusHtml = '<span class="badge badge-yellow">In Progress</span>';
        scoreHtml = '<div class="test-card-score"><span>Progress: ' + answeredCount + '/' + mock.questionCount + ' answered</span></div>';
        actionHtml = '<div class="test-card-actions">' +
          '<a href="/exam.html?test=' + encodeURIComponent(mockId) + '" class="btn btn-primary">Resume</a>' +
          '<a href="/exam.html?test=' + encodeURIComponent(mockId) + '&restart=1" class="btn btn-secondary">Restart</a>' +
          '</div>';
      } else if (result) {
        var passed = result.percentage >= 70;
        statusHtml = passed ? '<span class="badge badge-green">Passed</span>' : '<span class="badge badge-red">Needs Work</span>';
        scoreHtml = '<div class="test-card-score ' + (passed ? 'passed' : 'failed') + '">' +
          '<span>Last: ' + result.correct + '/' + result.total + '</span><strong>' + result.percentage + '%</strong></div>';
        actionHtml = '<div class="test-card-actions">' +
          '<a href="/exam.html?test=' + encodeURIComponent(mockId) + '" class="btn btn-primary">Retake</a>' +
          '<a href="/results.html?test=' + encodeURIComponent(mockId) + '" class="btn btn-secondary">Review</a>' +
          '<button type="button" class="btn btn-secondary btn-reset" data-mock-id="' + escapeHtml(mockId) + '" title="Clear score and show as Not Started">Reset</button>' +
          '</div>';
      } else {
        statusHtml = '<span class="badge badge-gray">Not Started</span>';
        actionHtml = '<div class="test-card-actions">' +
          '<a href="/exam.html?test=' + encodeURIComponent(mockId) + '" class="btn btn-primary btn-lg" style="flex:1">Start Test</a>' +
          '</div>';
      }

      var num = (mockId.replace('mock-', '') || 0);
      var subtitleHtml = mock.subtitle ? '<p class="test-card-subtitle">' + escapeHtml(mock.subtitle) + '</p>' : '';
      html += '<div class="test-card">' +
        '<div class="test-card-header">' +
          '<div class="test-card-number">' + num + '</div>' +
          '<div class="test-card-status">' + statusHtml + '</div>' +
        '</div>' +
        '<h3>' + escapeHtml(mock.title) + '</h3>' +
        subtitleHtml +
        '<div class="test-card-meta">' +
          '<span class="test-card-meta-item">&#9201; ' + mock.durationMinutes + ' min</span>' +
          '<span class="test-card-meta-item">&#9997; ' + mock.questionCount + ' Qs</span>' +
          '<span class="test-card-meta-item">&#9989; 70%</span>' +
        '</div>' +
        scoreHtml +
        actionHtml +
      '</div>';
    });
    grid.innerHTML = html;
  }

  function attachGridClickHandler(grid) {
    if (grid._gridClickAttached) return;
    grid._gridClickAttached = true;
    grid.addEventListener('click', function(e) {
      var resetBtn = e.target.closest('.btn-reset');
      if (resetBtn && grid.contains(resetBtn)) {
        e.preventDefault();
        var mockId = resetBtn.getAttribute('data-mock-id');
        if (!mockId) return;
        if (!confirm('Reset this test? Your score and progress will be cleared.')) return;
        StorageManager.clearExamState(mockId);
        StorageManager.clearResult(mockId);
        var mocks = cachedMocks;
        var results = StorageManager.loadAllResults(mocks.map(function(m) { return m.mockId; }));
        renderTestCards(mocks, results);
        return;
      }
      var a = e.target.closest('a');
      if (!a || !grid.contains(a)) return;
      var href = a.getAttribute('href') || '';
      if (href.indexOf('/exam.html') === -1 && href.indexOf('/results.html') === -1) return;
      e.preventDefault();
      var match = href.match(/test=([^&]+)/);
      if (match) {
        try { sessionStorage.setItem('pendingTestId', match[1]); } catch (err) {}
      }
      var basePath = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '') || '';
      var targetPath = href.replace(/\?.*$/, '').replace(/^\//, '');
      var search = href.indexOf('?') >= 0 ? href.substring(href.indexOf('?')) : '';
      var newUrl = window.location.origin + (basePath ? basePath + '/' : '/') + targetPath + search;
      window.location.href = newUrl;
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function init() {
    fetch('data/mocks.json')
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(mocks) {
        cachedMocks = mocks;
        var mockIds = mocks.map(function(m) { return m.mockId; });
        var results = StorageManager.loadAllResults(mockIds);
        var grid = document.getElementById('testGrid');
        renderTestCards(mocks, results);
        if (grid) attachGridClickHandler(grid);
      })
      .catch(function() {
        var grid = document.getElementById('testGrid');
        if (grid) {
          grid.innerHTML = '<p style="color: var(--text-secondary);">Failed to load tests. Run from a local server (e.g. npm start).</p>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
