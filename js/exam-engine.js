/* Exam Engine - Timer, navigation, state, single/multi-select, modals */

var ExamEngine = {
  mockId: null,
  mock: null,
  questions: [],
  questionsMap: {},
  currentIndex: 0,
  answers: {},
  markedForReview: [],
  startTimestamp: null,
  endTimestamp: null,
  timerInterval: null,
  warningShown10: false,
  warningShown5: false,
  passingPercentage: PASSING_PERCENTAGE,

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
    var restart = params.get('restart') === '1';

    if (!this.mockId || !MOCK_ID_PATTERN.test(this.mockId)) {
      window.location.href = 'index.html';
      return;
    }

    if (restart) {
      StorageManager.clearExamState(this.mockId);
    }

    var self = this;
    Promise.all([
      fetch('data/mocks.json').then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('data/questions.json').then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    ]).then(function(arr) {
      var mocks = arr[0];
      var allQuestions = arr[1];
      self.mock = mocks.find(function(m) { return m.mockId === self.mockId; });
      if (!self.mock) {
        window.location.href = 'index.html';
        return;
      }
      self.questionsMap = {};
      allQuestions.forEach(function(q) { self.questionsMap[q.id] = q; });
      self.questions = self.mock.questionIds.map(function(id) {
        var q = self.questionsMap[id];
        if (!q) return null;
        var isMulti = q.type === 'multi' || (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0);
        return {
          id: q.id,
          section: q.section || 1,
          questionText: q.questionText,
          options: q.options || [],
          correctAnswer: isMulti ? null : (q.correctAnswer || ''),
          correctAnswers: isMulti ? (q.correctAnswers || []) : null,
          type: isMulti ? 'multi' : 'single',
          requiredSelections: isMulti ? (q.requiredSelections || q.correctAnswers.length) : 1,
          explanation: q.explanation
        };
      }).filter(Boolean);

      if (self.questions.length === 0) {
        alert('No questions found for this test.');
        window.location.href = 'index.html';
        return;
      }

      document.getElementById('examTitle').textContent = self.mock.title;
      document.getElementById('examSubtitle').textContent = 'Generative AI Leader';

      var savedState = StorageManager.loadExamState(self.mockId);
      if (savedState && savedState.status === 'in_progress' && !restart && savedState.endTimestamp > Date.now()) {
        self.answers = savedState.answers || {};
        self.markedForReview = savedState.markedForReview || [];
        self.currentIndex = savedState.currentQuestionIndex || 0;
        self.startTimestamp = savedState.startTimestamp;
        self.endTimestamp = savedState.endTimestamp;
      } else {
        self.answers = {};
        self.markedForReview = [];
        self.currentIndex = 0;
        self.startTimestamp = Date.now();
        self.endTimestamp = self.startTimestamp + self.mock.durationMinutes * 60 * 1000;
      }

      self.saveState();
      self.startTimer();
      self.renderQuestion();
      self.renderPalette();
      self.updateNavButtons();
      self.updateMarkReviewButton();

      document.getElementById('btnEndExam').onclick = function() { self.showEndExamModal(); };
      document.getElementById('btnPrev').onclick = function() { self.prevQuestion(); };
      document.getElementById('btnNext').onclick = function() { self.nextQuestion(); };
      document.getElementById('btnMarkReview').onclick = function() { self.toggleMarkForReview(); };
      document.getElementById('btnReviewQuestions').onclick = function() { self.hideEndExamModal(); };
      document.getElementById('btnSubmitExam').onclick = function() { self.submitExam(); };
      document.getElementById('btnContinueWarning').onclick = function() { document.getElementById('timeWarningModal').classList.remove('active'); };
      document.getElementById('btnViewResults').onclick = function() { self.goToResults(); };

      document.addEventListener('visibilitychange', function() {
        if (!document.hidden) self.updateTimerDisplay();
      });

      document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          self.nextQuestion();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          self.prevQuestion();
        } else if (e.key >= '1' && e.key <= '9') {
          var optionIndex = parseInt(e.key, 10) - 1;
          var q = self.questions[self.currentIndex];
          if (q && q.options && q.options[optionIndex]) {
            e.preventDefault();
            self.selectAnswer(q.options[optionIndex].key);
          }
        }
      });
    }).catch(function() {
      document.getElementById('questionArea').innerHTML = '<p style="color: var(--text-secondary);">Failed to load data. Use a local server (npm start).</p>';
    });
  },

  escapeHtml: function(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  getCurrentQuestion: function() {
    return this.questions[this.currentIndex] || null;
  },

  getUserAnswer: function(qId) {
    var a = this.answers[qId];
    if (a == null) return [];
    return Array.isArray(a) ? a : [a];
  },

  renderQuestion: function() {
    var q = this.getCurrentQuestion();
    if (!q) return;
    var userAnswer = this.getUserAnswer(q.id);
    var sectionName = SECTION_NAMES[q.section] || 'Section ' + q.section;
    var sectionClass = 'badge-blue';
    if (q.section === 2) sectionClass = 'badge-green';
    else if (q.section === 3) sectionClass = 'badge-yellow';
    else if (q.section === 4) sectionClass = 'badge-red';

    var html = '<div class="question-progress">' +
      '<span class="question-number">Question ' + (this.currentIndex + 1) + ' of ' + this.questions.length + '</span>' +
      '<span class="badge ' + sectionClass + '">' + sectionName + '</span></div>';
    if (q.type === 'multi') {
      html += '<div class="question-multi-hint">Select ' + (q.requiredSelections || q.correctAnswers.length) + ' answers</div>';
    }
    var listRole = q.type === 'multi' ? 'group' : 'radiogroup';
    var itemRole = q.type === 'multi' ? 'checkbox' : 'radio';
    html += '<div class="question-text">' + this.escapeHtml(q.questionText) + '</div><ul class="options-list" role="' + listRole + '" aria-label="Answer options">';
    var self = this;
    q.options.forEach(function(opt) {
      var selected = userAnswer.indexOf(opt.key) !== -1;
      var inputType = q.type === 'multi' ? 'option-checkbox' : 'option-radio';
      html += '<li class="option-item' + (selected ? ' selected' : '') + '" data-key="' + opt.key + '" role="' + itemRole + '" aria-checked="' + selected + '" tabindex="0">' +
        '<div class="' + inputType + '"></div>' +
        '<span class="option-key">' + opt.key + '.</span>' +
        '<span class="option-text">' + self.escapeHtml(opt.text) + '</span></li>';
    });
    html += '</ul>';
    document.getElementById('questionArea').innerHTML = html;
    document.getElementById('questionArea').querySelectorAll('.option-item').forEach(function(item) {
      item.addEventListener('click', function() { ExamEngine.selectAnswer(item.getAttribute('data-key')); });
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ExamEngine.selectAnswer(item.getAttribute('data-key'));
        }
      });
    });
  },

  renderPalette: function() {
    var ids = this.mock.questionIds;
    var html = '';
    for (var i = 0; i < ids.length; i++) {
      var qId = ids[i];
      var ans = this.answers[qId];
      var answered = ans != null && (Array.isArray(ans) ? ans.length > 0 : true);
      var flagged = this.markedForReview.indexOf(qId) !== -1;
      var current = i === this.currentIndex;
      var cls = 'palette-btn';
      if (answered) cls += ' answered';
      if (flagged) cls += ' flagged';
      if (current) cls += ' current';
      var ariaLabel = 'Question ' + (i + 1);
      if (answered) ariaLabel += ', answered';
      if (flagged) ariaLabel += ', marked for review';
      if (current) ariaLabel += ', current';
      html += '<button type="button" class="' + cls + '" data-index="' + i + '" aria-label="' + ariaLabel + '"' + (current ? ' aria-current="true"' : '') + '>' + (i + 1) + '</button>';
    }
    document.getElementById('paletteGrid').innerHTML = html;
    document.getElementById('paletteGrid').querySelectorAll('button').forEach(function(btn) {
      btn.onclick = function() { ExamEngine.goToQuestion(parseInt(btn.getAttribute('data-index'), 10)); };
    });

    var answered = 0, unanswered = 0;
    ids.forEach(function(qId) {
      var a = ExamEngine.answers[qId];
      if (a != null && (Array.isArray(a) ? a.length > 0 : true)) answered++; else unanswered++;
    });
    document.getElementById('navSummary').innerHTML =
      '<div class="nav-summary-item"><div class="nav-summary-dot answered"></div> ' + answered + ' Answered</div>' +
      '<div class="nav-summary-item"><div class="nav-summary-dot unanswered"></div> ' + unanswered + ' Unanswered</div>' +
      '<div class="nav-summary-item"><div class="nav-summary-dot flagged"></div> ' + this.markedForReview.length + ' Marked</div>';
  },

  updateNavButtons: function() {
    var prev = document.getElementById('btnPrev');
    var next = document.getElementById('btnNext');
    prev.disabled = this.currentIndex === 0;
    prev.style.opacity = this.currentIndex === 0 ? '0.5' : '1';
    if (this.currentIndex === this.questions.length - 1) {
      next.textContent = 'Finish';
      next.onclick = function() { ExamEngine.showEndExamModal(); };
    } else {
      next.innerHTML = 'Next &#8594;';
      next.onclick = function() { ExamEngine.nextQuestion(); };
    }
  },

  updateMarkReviewButton: function() {
    var q = this.getCurrentQuestion();
    var marked = q && this.markedForReview.indexOf(q.id) !== -1;
    var btn = document.getElementById('btnMarkReview');
    var text = document.getElementById('markReviewText');
    if (marked) { btn.classList.add('marked'); text.textContent = 'Marked for Review'; }
    else { btn.classList.remove('marked'); text.textContent = 'Mark for Review'; }
  },

  goToQuestion: function(index) {
    if (index < 0 || index >= this.questions.length) return;
    this.currentIndex = index;
    document.getElementById('questionArea').scrollTop = 0;
    this.renderQuestion();
    this.renderPalette();
    this.updateNavButtons();
    this.updateMarkReviewButton();
    this.saveState();
  },

  nextQuestion: function() {
    if (this.currentIndex < this.questions.length - 1) this.goToQuestion(this.currentIndex + 1);
  },

  prevQuestion: function() {
    if (this.currentIndex > 0) this.goToQuestion(this.currentIndex - 1);
  },

  selectAnswer: function(key) {
    var q = this.getCurrentQuestion();
    if (!q) return;
    var qId = q.id;
    if (q.type === 'multi') {
      var arr = this.getUserAnswer(qId).slice();
      var idx = arr.indexOf(key);
      if (idx !== -1) arr.splice(idx, 1);
      else arr.push(key);
      this.answers[qId] = arr.length ? arr : null;
    } else {
      var current = this.answers[qId];
      if (current === key || (Array.isArray(current) && current[0] === key)) this.answers[qId] = null;
      else this.answers[qId] = key;
    }
    this.renderQuestion();
    this.renderPalette();
    this.saveState();
  },

  toggleMarkForReview: function() {
    var q = this.getCurrentQuestion();
    if (!q) return;
    var idx = this.markedForReview.indexOf(q.id);
    if (idx !== -1) this.markedForReview.splice(idx, 1);
    else this.markedForReview.push(q.id);
    this.renderPalette();
    this.updateMarkReviewButton();
    this.saveState();
  },

  saveState: function() {
    StorageManager.saveExamState(this.mockId, {
      status: 'in_progress',
      answers: this.answers,
      markedForReview: this.markedForReview,
      currentQuestionIndex: this.currentIndex,
      startTimestamp: this.startTimestamp,
      endTimestamp: this.endTimestamp
    });
  },

  startTimer: function() {
    this.updateTimerDisplay();
    var self = this;
    this.timerInterval = setInterval(function() { self.updateTimerDisplay(); }, 1000);
  },

  updateTimerDisplay: function() {
    var remaining = Math.max(0, this.endTimestamp - Date.now());
    var totalSeconds = Math.ceil(remaining / 1000);
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    var el = document.getElementById('timer');
    el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    el.classList.remove('warning', 'danger');
    if (totalSeconds <= 0) {
      clearInterval(this.timerInterval);
      this.autoSubmit();
      return;
    }
    if (totalSeconds <= 300) {
      el.classList.add('danger');
      if (!this.warningShown5) {
        this.warningShown5 = true;
        document.getElementById('timeWarningTitle').innerHTML = '&#9888; 5 Minutes Left';
        document.getElementById('timeWarningMessage').textContent = 'You have 5 minutes left. Please finalize your answers.';
        document.getElementById('timeWarningModal').classList.add('active');
      }
    } else if (totalSeconds <= 600) {
      el.classList.add('warning');
      if (!this.warningShown10) {
        this.warningShown10 = true;
        document.getElementById('timeWarningTitle').innerHTML = '&#9888; 10 Minutes Remaining';
        document.getElementById('timeWarningMessage').textContent = 'You have 10 minutes remaining. Please review your answers.';
        document.getElementById('timeWarningModal').classList.add('active');
      }
    }
  },

  getAnsweredCount: function() {
    var n = 0;
    this.mock.questionIds.forEach(function(qId) {
      var a = ExamEngine.answers[qId];
      if (a != null && (Array.isArray(a) ? a.length > 0 : true)) n++;
    });
    return n;
  },

  showEndExamModal: function() {
    document.getElementById('modalAnswered').textContent = this.getAnsweredCount();
    document.getElementById('modalUnanswered').textContent = this.questions.length - this.getAnsweredCount();
    document.getElementById('modalMarked').textContent = this.markedForReview.length;
    document.getElementById('endExamModal').classList.add('active');
  },

  hideEndExamModal: function() {
    document.getElementById('endExamModal').classList.remove('active');
  },

  isAnswerCorrect: function(q, userAnswer) {
    var u = Array.isArray(userAnswer) ? userAnswer.slice().sort() : (userAnswer ? [userAnswer] : []);
    if (q.type === 'multi' && q.correctAnswers) {
      var c = q.correctAnswers.slice().sort();
      if (u.length !== c.length) return false;
      for (var i = 0; i < c.length; i++) if (u[i] !== c[i]) return false;
      return true;
    }
    return u.length === 1 && u[0] === q.correctAnswer;
  },

  calculateResults: function() {
    var correct = 0;
    var sectionScores = { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 }, 4: { correct: 0, total: 0 } };
    var questionResults = [];
    for (var i = 0; i < this.questions.length; i++) {
      var q = this.questions[i];
      var u = this.answers[q.id];
      var userArr = u == null ? [] : (Array.isArray(u) ? u : [u]);
      var isCorrect = this.isAnswerCorrect(q, userArr);
      if (isCorrect) correct++;
      var sec = q.section || 1;
      sectionScores[sec].total++;
      if (isCorrect) sectionScores[sec].correct++;
      questionResults.push({
        questionIndex: i,
        correct: isCorrect,
        userAnswer: userArr,
        correctAnswer: q.type === 'multi' ? (q.correctAnswers || []) : (q.correctAnswer || ''),
        question: q
      });
    }
    var total = this.questions.length;
    var percentage = total ? Math.round((correct / total) * 100) : 0;
    var timeTaken = Math.round((Date.now() - this.startTimestamp) / 1000);
    return {
      correct: correct,
      total: total,
      percentage: percentage,
      passed: percentage >= this.passingPercentage,
      sectionScores: sectionScores,
      questionResults: questionResults,
      timeTaken: timeTaken
    };
  },

  autoSubmit: function() {
    clearInterval(this.timerInterval);
    var result = this.calculateResults();
    StorageManager.saveResult(this.mockId, result);
    StorageManager.clearExamState(this.mockId);
    document.getElementById('timesUpModal').classList.add('active');
  },

  submitExam: function() {
    clearInterval(this.timerInterval);
    var result = this.calculateResults();
    StorageManager.saveResult(this.mockId, result);
    StorageManager.clearExamState(this.mockId);
    this.hideEndExamModal();
    this.goToResults();
  },

  goToResults: function() {
    window.location.href = 'results.html?test=' + encodeURIComponent(this.mockId);
  }
};

document.addEventListener('DOMContentLoaded', function() { ExamEngine.init(); });
