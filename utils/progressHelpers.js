export function mapToObject(mapValue) {
  if (!mapValue) return {};
  if (mapValue instanceof Map) return Object.fromEntries(mapValue);
  if (typeof mapValue === 'object' && !Array.isArray(mapValue)) return mapValue;
  return {};
}

export function serializeProgress(progress) {
  if (!progress) {
    return {
      checked: {},
      dayDone: {},
      dayActivity: {},
      dayNotes: {},
      knowledgeNotes: {},
      bookmarks: [],
      achievements: [],
      revisionState: {},
      settings: { darkMode: false },
      skillMap: { topics: {}, phases: {}, gates: {}, activity: [] },
    };
  }

  return {
    checked: mapToObject(progress.checked),
    dayDone: mapToObject(progress.dayDone),
    dayActivity: mapToObject(progress.dayActivity),
    dayNotes: mapToObject(progress.dayNotes),
    knowledgeNotes: mapToObject(progress.knowledgeNotes),
    bookmarks: progress.bookmarks || [],
    achievements: progress.achievements || [],
    revisionState: mapToObject(progress.revisionState),
    settings: progress.settings || { darkMode: false },
    skillMap: {
      topics: progress.skillMap?.topics || {},
      phases: progress.skillMap?.phases || {},
      gates: progress.skillMap?.gates || {},
      activity: progress.skillMap?.activity || [],
    },
  };
}
