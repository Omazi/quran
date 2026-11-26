import {
  acceptFriendRequest,
  addGroupMember,
  bondBetween,
  createGroup,
  createProfile,
  NO_BOND,
  replaceBond,
  requestFriendship,
  toBadge,
  toDailyReading,
  toGardenSummary,
  type Badge,
  type BondTables,
  type DailyReading,
  type GardenSummary,
  type GardenSummaryInput,
  type GroupState,
  type Nudge,
  type Profile,
  type SocialData,
  type UserId,
} from '@/domain/social';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import { DEMO_GROUP_ID, DEMO_GROUP_NAME, DEMO_HISTORY_DAYS, DEMO_USERS } from './config';

/**
 * The starting data of the demonstration: Omar, three friends in three different states, one
 * request waiting for an answer, and a group with a leaderboard. Every row is made by a
 * function of the domain, so the data obeys the rules by construction. The same `today`
 * always gives the same data: the days are counted back from it.
 */

const { omar, mustapha, sarah, taghread, yacine } = DEMO_USERS;

interface DemoPerson {
  readonly id: UserId;
  readonly name: string;
  readonly joinedDaysAgo: number;
  /** Null: this person's app has not published a garden yet. */
  readonly garden:
    | (Omit<GardenSummaryInput, 'lastWateredOn'> & {
        readonly wateredDaysAgo: number | null;
      })
    | null;
  /** Days ago of each completed khatma, the first one first. */
  readonly badgesDaysAgo: readonly number[];
  /** Pages read for the first time on a day, from the number of days ago (0 is today). */
  readonly pagesOn: (daysAgo: number) => number;
}

/** A pattern that varies from day to day without any randomness. */
function pattern(step: number, shift: number): (daysAgo: number) => number {
  return (daysAgo) => ((daysAgo * 7 + shift) % 6) * step;
}

const PEOPLE: readonly DemoPerson[] = [
  {
    id: omar,
    name: 'Omar',
    joinedDaysAgo: 120,
    garden: {
      khatmNumber: 2,
      hizbCompleted: 17,
      health: 0.8,
      wateredDaysAgo: 0,
      streakDays: 5,
      badgeCount: 1,
      wordsRead: 99_367,
      versesRead: 8000,
      hasanatEstimate: 4_272_781,
    },
    badgesDaysAgo: [60],
    pagesOn: pattern(4, 1),
  },
  {
    // A flourishing garden: watered every day for weeks.
    id: mustapha,
    name: 'Mustapha',
    joinedDaysAgo: 110,
    garden: {
      khatmNumber: 3,
      hizbCompleted: 42,
      health: 0.95,
      wateredDaysAgo: 0,
      streakDays: 21,
      badgeCount: 2,
      wordsRead: 209_061,
      versesRead: 16_837,
      hasanatEstimate: 8_989_623,
    },
    badgesDaysAgo: [90, 40],
    pagesOn: (daysAgo) => 6 + (daysAgo % 5) * 3,
  },
  {
    // A garden that is thirsty: nothing read for six days, by a reader of three khatmas.
    id: sarah,
    name: 'Sarah',
    joinedDaysAgo: 100,
    garden: {
      // Three khatmas completed (level 4, D46), the fourth at hizb 9.
      khatmNumber: 4,
      hizbCompleted: 9,
      health: 0.25,
      wateredDaysAgo: 6,
      streakDays: 0,
      badgeCount: 3,
      wordsRead: 243_905,
      versesRead: 19_643,
      hasanatEstimate: 10_487_894,
    },
    badgesDaysAgo: [160, 100, 45],
    pagesOn: (daysAgo) => (daysAgo < 6 ? 0 : pattern(3, 2)(daysAgo)),
  },
  {
    // A complete garden: 60 hizb, the first khatma finished.
    id: taghread,
    name: 'Taghread',
    joinedDaysAgo: 90,
    garden: {
      khatmNumber: 1,
      hizbCompleted: 60,
      health: 1,
      wateredDaysAgo: 1,
      streakDays: 30,
      badgeCount: 1,
      wordsRead: 77_430,
      versesRead: 6236,
      hasanatEstimate: 3_329_490,
    },
    badgesDaysAgo: [1],
    pagesOn: pattern(5, 3),
  },
  {
    // Has asked Omar and waits: only the name is known of this person, and no garden yet.
    id: yacine,
    name: 'Yacine',
    joinedDaysAgo: 3,
    garden: null,
    badgesDaysAgo: [],
    pagesOn: () => 0,
  },
];

const FRIENDS_OF_OMAR: readonly UserId[] = [mustapha, sarah, taghread];
const FRIENDSHIP_DAYS_AGO = 80;
const REQUEST_DAYS_AGO = 1;
const GROUP_CREATED_DAYS_AGO = 70;

function profileOf(person: DemoPerson, today: LocalDate): Profile {
  return createProfile(person.id, person.name, addDays(today, -person.joinedDaysAgo));
}

function gardenOf(person: DemoPerson, today: LocalDate): GardenSummary | null {
  if (person.garden === null) return null;
  const { wateredDaysAgo, ...values } = person.garden;
  return toGardenSummary(
    person.id,
    { ...values, lastWateredOn: wateredDaysAgo === null ? null : addDays(today, -wateredDaysAgo) },
    today,
  );
}

function badgesOf(person: DemoPerson, today: LocalDate): Badge[] {
  return person.badgesDaysAgo.map((daysAgo, index) =>
    toBadge(person.id, { khatmNumber: index + 1, completedOn: addDays(today, -daysAgo) }, today),
  );
}

function readingsOf(person: DemoPerson, today: LocalDate): DailyReading[] {
  const readings: DailyReading[] = [];
  for (let daysAgo = 0; daysAgo < DEMO_HISTORY_DAYS; daysAgo += 1) {
    const newPages = person.pagesOn(daysAgo);
    if (newPages > 0)
      readings.push(toDailyReading(person.id, addDays(today, -daysAgo), newPages, today));
  }
  return readings;
}

/** Friendships and the request, made by the rules of friend requests. */
function bondTables(today: LocalDate): BondTables {
  let tables: BondTables = { friendships: [], blocks: [] };
  for (const friendId of FRIENDS_OF_OMAR) {
    const asked = addDays(today, -FRIENDSHIP_DAYS_AGO);
    const pending = requestFriendship(NO_BOND, omar, friendId, asked);
    tables = replaceBond(
      tables,
      omar,
      friendId,
      acceptFriendRequest(pending, friendId, addDays(asked, 1)),
    );
  }
  const request = requestFriendship(NO_BOND, yacine, omar, addDays(today, -REQUEST_DAYS_AGO));
  return replaceBond(tables, yacine, omar, request);
}

/** Omar's group, with the three friends, joined in the order of their friendship. */
function demoGroup(tables: BondTables, today: LocalDate): GroupState {
  const created = addDays(today, -GROUP_CREATED_DAYS_AGO);
  let state = createGroup(DEMO_GROUP_ID, DEMO_GROUP_NAME, omar, created);
  FRIENDS_OF_OMAR.forEach((friendId, index) => {
    state = addGroupMember(
      state,
      omar,
      friendId,
      bondBetween(tables, omar, friendId),
      addDays(created, index + 1),
    );
  });
  return state;
}

export function createDemoSocialData(today: LocalDate): SocialData {
  const tables = bondTables(today);
  const group = demoGroup(tables, today);
  const nudges: Nudge[] = [
    { fromId: mustapha, toId: omar, kind: 'encourage', sentOn: addDays(today, -1) },
  ];

  return {
    profiles: PEOPLE.map((person) => profileOf(person, today)),
    gardenSummaries: PEOPLE.flatMap((person) => gardenOf(person, today) ?? []),
    friendships: tables.friendships,
    blocks: tables.blocks,
    invites: [],
    nudges,
    groups: [group.group],
    groupMembers: group.members,
    dailyReadings: PEOPLE.flatMap((person) => readingsOf(person, today)),
    badges: PEOPLE.flatMap((person) => badgesOf(person, today)),
    readingBackups: [],
  };
}
