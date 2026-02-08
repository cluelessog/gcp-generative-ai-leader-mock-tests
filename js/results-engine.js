/* Results Engine - Score ring, section breakdown, answer review (single/multi) */

var ResultsEngine = {
  mockId: null,
  mockTitle: null,
  result: null,
  currentFilter: 'all',

  init: function() {
    var params = new URLSearchParams(window.location.search);
    this.mockId = params.get('test');
    if (!this.mockId) {
      try {
        var pending = sessionStorage.getItem('pendingTestId');
        if (pending) {
          this.mockId = pending;
          sessionStorage.removeItem('pendingTestId');
        }
      } catch (err) {}
    }
    if (!this.mockId || !MOCK_ID_PATTERN.test(this.mockId)) {
      window.location.href = 'index.html';
      return;
    }

    this.result = StorageManager.loadResult(this.mockId);
    if (!this.result) {
      document.getElementById('resultsContainer').innerHTML =
        '<div class="text-center mt-lg"><p style="color: var(--text-secondary);">No results found. Take the test first.</p>' +
        '<a href="index.html" class="btn btn-primary mt-md">Back to Dashboard</a></div>';
      return;
    }

    fetch('data/mocks.json')
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(mocks) {
        var mock = mocks.find(function(m) { return m.mockId === ResultsEngine.mockId; });
        ResultsEngine.mockTitle = mock ? mock.title : ResultsEngine.mockId;
        ResultsEngine.renderResults();
      })
      .catch(function() {
        ResultsEngine.mockTitle = ResultsEngine.mockId;
        ResultsEngine.renderResults();
      });
  },

  escapeHtml: function(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  renderResults: function() {
    var container = document.getElementById('resultsContainer');
    var html = this.renderScoreCard() +
      this.renderSectionBreakdown() +
      '<div class="results-actions">' +
      '<button class="btn btn-primary btn-lg" onclick="ResultsEngine.toggleReview()">Review Answers</button>' +
      '<a href="exam.html?test=' + encodeURIComponent(this.mockId) + '" class="btn btn-secondary btn-lg">Retake Test</a>' +
      '<a href="index.html" class="btn btn-secondary btn-lg">Dashboard</a>' +
      '</div>' +
      '<div class="review-container hidden" id="reviewContainer">' +
      this.renderReviewSection() +
      '</div>';
    container.innerHTML = html;
    document.getElementById('resultsTitle').textContent = (this.mockTitle || this.mockId) + ' - Results';
    this.attachReviewListeners();
    setTimeout(function() { ResultsEngine.animateScoreRing(); }, 100);
  },

  renderScoreCard: function() {
    var r = this.result;
    var passClass = r.passed ? 'pass' : 'fail';
    var passText = r.passed ? 'PASSED' : 'NEEDS IMPROVEMENT';
    var passIcon = r.passed ? '&#10003;' : '&#10007;';
    var minutes = Math.floor(r.timeTaken / 60);
    var seconds = r.timeTaken % 60;
    var timeStr = minutes + 'm ' + seconds + 's';
    var radius = 75;
    var circumference = 2 * Math.PI * radius;
    return '<div class="score-card">' +
      '<div class="score-ring-container">' +
        '<div class="score-ring">' +
          '<svg viewBox="0 0 180 180" role="img" aria-label="Score: ' + r.percentage + '%, ' + r.correct + ' of ' + r.total + ' correct">' +
            '<circle class="score-ring-bg" cx="90" cy="90" r="' + radius + '"/>' +
            '<circle class="score-ring-fill ' + passClass + '" cx="90" cy="90" r="' + radius + '" ' +
              'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + circumference + '" id="scoreRingFill"/>' +
          '</svg>' +
        '</div>' +
        '<div class="score-ring-text">' +
          '<div class="score-percentage">' + r.percentage + '%</div>' +
          '<div class="score-fraction">' + r.correct + ' / ' + r.total + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="score-result-badge ' + passClass + '">' + passIcon + ' ' + passText + '</div>' +
      '<div class="score-time">Time taken: ' + timeStr + '</div>' +
      '</div>';
  },

  animateScoreRing: function() {
    var ring = document.getElementById('scoreRingFill');
    if (!ring) return;
    var radius = 75;
    var circumference = 2 * Math.PI * radius;
    ring.style.strokeDashoffset = circumference * (1 - this.result.percentage / 100);
  },

  renderSectionBreakdown: function() {
    var scores = this.result.sectionScores || {};
    var html = '<div class="section-breakdown"><h2>Section Breakdown</h2>';
    for (var s = 1; s <= 4; s++) {
      var score = scores[s];
      if (!score || score.total === 0) continue;
      var pct = Math.round((score.correct / score.total) * 100);
      var barClass = pct >= 80 ? 'excellent' : (pct >= 60 ? 'good' : 'poor');
      html += '<div class="section-row">' +
        '<div class="section-name">' + SECTION_NAMES[s] + '</div>' +
        '<div class="section-bar-container"><div class="section-bar ' + barClass + '" style="width:' + pct + '%;"></div></div>' +
        '<div class="section-score">' + score.correct + '/' + score.total + '<span class="section-pct">(' + pct + '%)</span></div>' +
        '</div>';
    }
    return html + '</div>';
  },

  toggleReview: function() {
    var container = document.getElementById('reviewContainer');
    container.classList.toggle('hidden');
    if (!container.classList.contains('hidden')) container.scrollIntoView({ behavior: 'smooth' });
  },

  renderReviewSection: function() {
    return '<div class="review-header">' +
      '<h2>Answer Review</h2>' +
      '<div class="review-filters">' +
        '<button class="filter-btn active" data-filter="all" onclick="ResultsEngine.setFilter(\'all\', this)">All</button>' +
        '<button class="filter-btn" data-filter="incorrect" onclick="ResultsEngine.setFilter(\'incorrect\', this)">Incorrect Only</button>' +
        '<button class="filter-btn" data-filter="correct" onclick="ResultsEngine.setFilter(\'correct\', this)">Correct Only</button>' +
        '<button class="filter-btn" data-filter="section-1" onclick="ResultsEngine.setFilter(\'section-1\', this)">S1</button>' +
        '<button class="filter-btn" data-filter="section-2" onclick="ResultsEngine.setFilter(\'section-2\', this)">S2</button>' +
        '<button class="filter-btn" data-filter="section-3" onclick="ResultsEngine.setFilter(\'section-3\', this)">S3</button>' +
        '<button class="filter-btn" data-filter="section-4" onclick="ResultsEngine.setFilter(\'section-4\', this)">S4</button>' +
      '</div></div>' +
      '<div id="reviewList">' + this.renderReviewQuestions('all') + '</div>';
  },

  renderReviewQuestions: function(filter) {
    var results = this.result.questionResults || [];
    var sectionNum = filter.indexOf('section-') === 0 ? parseInt(filter.replace('section-', ''), 10) : null;
    var html = '';
    for (var i = 0; i < results.length; i++) {
      var qr = results[i];
      var q = qr.question;
      if (!q) continue;
      if (filter === 'incorrect' && qr.correct) continue;
      if (filter === 'correct' && !qr.correct) continue;
      if (sectionNum !== null && (q.section !== sectionNum)) continue;

      var resultIcon = qr.correct ? '&#10003;' : '&#10007;';
      var resultClass = qr.correct ? 'correct' : 'incorrect';
      var correctArr = Array.isArray(qr.correctAnswer) ? qr.correctAnswer : [qr.correctAnswer];
      var userArr = qr.userAnswer || [];

      html += '<div class="review-question" id="reviewQ' + i + '">' +
        '<div class="review-question-header" role="button" tabindex="0" aria-expanded="false" data-review-index="' + i + '">' +
          '<div class="review-result-icon ' + resultClass + '">' + resultIcon + '</div>' +
          '<div class="review-question-title">Q' + (i + 1) + '. ' + this.escapeHtml((q.questionText || '').substring(0, 120)) + (q.questionText && q.questionText.length > 120 ? '...' : '') + '</div>' +
          '<span class="review-expand-icon">&#9660;</span>' +
        '</div>' +
        '<div class="review-question-body">';

      var sectionClass = 'badge-blue';
      if (q.section === 2) sectionClass = 'badge-green';
      else if (q.section === 3) sectionClass = 'badge-yellow';
      else if (q.section === 4) sectionClass = 'badge-red';
      html += '<span class="badge ' + sectionClass + ' mb-md" style="display:inline-flex;">' + (SECTION_NAMES[q.section] || 'Section ' + q.section) + '</span>';
      html += '<div class="question-text" style="border:none;padding:0;margin-bottom:12px;">' + this.escapeHtml(q.questionText) + '</div><ul class="options-list">';

      var self = this;
      (q.options || []).forEach(function(opt) {
        var isUserSelected = userArr.indexOf(opt.key) !== -1;
        var isCorrectOpt = correctArr.indexOf(opt.key) !== -1;
        var optClass = 'option-item';
        if (isCorrectOpt) optClass += ' correct-answer';
        if (isUserSelected && !isCorrectOpt) optClass += ' wrong-answer';
        if (isUserSelected) optClass += ' selected';
        var indicator = '';
        if (isUserSelected && isCorrectOpt) indicator = ' &#10003;';
        else if (isUserSelected && !isCorrectOpt) indicator = ' &#10007;';
        else if (isCorrectOpt) indicator = ' &#10003; (Correct)';
        html += '<li class="' + optClass + '" style="cursor:default;">' +
          '<span class="option-key">' + opt.key + '.</span>' +
          '<span class="option-text">' + self.escapeHtml(opt.text) + indicator + '</span></li>';
      });
      html += '</ul>';
      if (q.explanation) {
        html += '<div class="review-explanation"><strong>Explanation:</strong> ' + this.escapeHtml(q.explanation) + '</div>';
      }
      html += '</div></div>';
    }
    if (!html) html = '<p style="color: var(--text-secondary); text-align: center; padding: 24px;">No questions match this filter.</p>';
    return html;
  },

  setFilter: function(filter, btn) {
    this.currentFilter = filter;
    var buttons = document.querySelectorAll('.filter-btn');
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
    btn.classList.add('active');
    document.getElementById('reviewList').innerHTML = this.renderReviewQuestions(filter);
    this.attachReviewListeners();
  },

  toggleQuestion: function(index) {
    var el = document.getElementById('reviewQ' + index);
    if (!el) return;
    el.classList.toggle('expanded');
    var header = el.querySelector('.review-question-header');
    if (header) header.setAttribute('aria-expanded', el.classList.contains('expanded'));
  },

  attachReviewListeners: function() {
    document.querySelectorAll('.review-question-header').forEach(function(header) {
      var idx = parseInt(header.getAttribute('data-review-index'), 10);
      header.addEventListener('click', function() { ResultsEngine.toggleQuestion(idx); });
      header.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ResultsEngine.toggleQuestion(idx);
        }
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', function() { ResultsEngine.init(); });
