const { buildClassroomFromDraft } = require('./generator');
const { normalizeClassroom } = require('./schema');

function applyClassroomToState(state, classroom, source = 'draft', status = '') {
  if (!state) return null;

  state.classroom = classroom || null;
  state.classroomSource = classroom ? source : '';
  state.classroomUpdatedAt = classroom
    ? new Date(classroom.updatedAt || Date.now()).toISOString()
    : '';
  state.classroomVersion = (state.classroomVersion || 0) + (classroom ? 1 : 0);

  if (status) {
    state.sceneStatus = classroom ? status : 'idle';
  }

  return state.classroom;
}

function clearClassroomFromState(state) {
  if (!state) return;
  state.classroom = null;
  state.classroomSource = '';
  state.classroomUpdatedAt = '';
}

function syncClassroomFromDraft(state, options = {}) {
  if (!state?.draft) {
    clearClassroomFromState(state);
    if (options.status) state.sceneStatus = 'idle';
    return null;
  }

  const classroom = buildClassroomFromDraft(state.draft, {
    state,
    source: options.source || 'draft'
  });
  return applyClassroomToState(state, classroom, options.source || 'draft', options.status || '');
}

function applyRawClassroomToState(state, rawClassroom, options = {}) {
  const classroom = normalizeClassroom(rawClassroom, {
    state,
    draft: state?.draft || null,
    source: options.source || 'external'
  });
  return applyClassroomToState(state, classroom, options.source || 'external', options.status || '');
}

module.exports = {
  applyClassroomToState,
  applyRawClassroomToState,
  clearClassroomFromState,
  syncClassroomFromDraft
};
