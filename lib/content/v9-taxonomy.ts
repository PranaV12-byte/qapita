import { ALL_NODES } from "./tree";
import { V9_TAXONOMY, type V9Group, type V9Subtopic } from "./v9-taxonomy.generated";

export { V9_TAXONOMY };
export type { V9Group, V9Subtopic };

/**
 * One legacy topic has one V9 home. This keeps existing article routes, saved
 * Brain edges and generator nodeId links valid while the visible taxonomy uses
 * the approved V9 hierarchy.
 */
export const LEGACY_TO_V9_TOPIC: Record<string, string> = {
  "1.1": "v9-1.2", "1.2": "v9-1.1", "1.3": "v9-1.3", "1.4": "v9-1.6", "1.5": "v9-1.5",
  "1.6": "v9-1.7", "1.7": "v9-1.3", "1.8": "v9-1.8", "1.9": "v9-1.9", "1.10": "v9-1.10",
  "2.1": "v9-2.1", "2.2": "v9-2.2", "2.3": "v9-2.3", "2.4": "v9-2.4", "2.5": "v9-2.4",
  "2.6": "v9-2.1", "2.7": "v9-2.5",
  "3.1": "v9-3.2", "3.2": "v9-3.1", "3.3": "v9-3.3", "3.4": "v9-3.1", "3.5": "v9-3.4",
  "3.6": "v9-3.6", "3.7": "v9-3.1", "3.8": "v9-3.1", "3.9": "v9-3.5", "3.10": "v9-3.7",
  "4.1": "v9-6.1", "4.2": "v9-6.1", "4.3": "v9-6.3", "4.4": "v9-6.4", "4.5": "v9-6.1", "4.6": "v9-6.2",
  "5.1": "v9-4.5", "5.2": "v9-4.2", "5.3": "v9-4.3", "5.4": "v9-4.5", "5.5": "v9-4.5",
  "5.6": "v9-4.5", "5.7": "v9-4.4", "5.8": "v9-4.1",
  "6.1": "v9-5.1", "6.2": "v9-5.1", "6.3": "v9-5.1", "6.4": "v9-5.1", "6.5": "v9-5.3",
  "6.6": "v9-5.2", "6.7": "v9-5.4", "6.8": "v9-5.5", "6.9": "v9-5.7",
  "7.1": "v9-5.6", "7.2": "v9-5.6", "7.3": "v9-2.5", "7.4": "v9-5.6", "7.5": "v9-3.6",
  "8.1": "v9-7.1", "8.2": "v9-7.2", "8.3": "v9-7.3", "8.4": "v9-7.4", "8.5": "v9-7.5", "8.6": "v9-7.6",
  "9.1": "v9-8.1", "9.2": "v9-8.2", "9.3": "v9-8.3", "9.4": "v9-8.4", "9.5": "v9-8.5", "9.6": "v9-8.6",
  "9.7": "v9-8.7", "9.8": "v9-8.8",
};

export const V9_SUBTOPICS = V9_TAXONOMY.flatMap((group) => group.subtopics);
export const V9_ACTIVE_SUBTOPICS = V9_SUBTOPICS.filter((topic) => !topic.comingSoon);

const V9_IDS = new Set(V9_SUBTOPICS.map((topic) => topic.id));
const LEGACY_BY_V9 = new Map<string, string[]>();
for (const [legacyId, v9Id] of Object.entries(LEGACY_TO_V9_TOPIC)) {
  const ids = LEGACY_BY_V9.get(v9Id) ?? [];
  ids.push(legacyId);
  LEGACY_BY_V9.set(v9Id, ids);
}

if (Object.keys(LEGACY_TO_V9_TOPIC).length !== ALL_NODES.length) {
  throw new Error("The V9 taxonomy mapping must cover every legacy topic.");
}
if (Object.values(LEGACY_TO_V9_TOPIC).some((topicId) => !V9_IDS.has(topicId))) {
  throw new Error("The V9 taxonomy mapping contains an unknown V9 topic.");
}

export function getV9Group(groupId: string): V9Group | undefined {
  return V9_TAXONOMY.find((group) => group.id === groupId);
}

export function getV9Subtopic(topicId: string): V9Subtopic | undefined {
  return V9_SUBTOPICS.find((topic) => topic.id === topicId);
}

export function toV9TopicId(topicId: string | undefined): string | undefined {
  if (!topicId) return undefined;
  return V9_IDS.has(topicId) ? topicId : LEGACY_TO_V9_TOPIC[topicId];
}

export function legacyTopicIdsForV9(topicId: string): string[] {
  return LEGACY_BY_V9.get(topicId) ?? [];
}

export function primaryLegacyTopicId(topicId: string): string | undefined {
  return legacyTopicIdsForV9(topicId)[0];
}

export function v9SearchText(topic: V9Subtopic, group: V9Group): string {
  return [group.name, topic.name, ...topic.leaves.map((leaf) => leaf.name)].join(" ");
}
