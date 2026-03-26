/**
 * MCP Tools - Functions callable by the LLM
 *
 * Add your tool implementations here. Each tool receives validated
 * arguments and returns content for the client.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RelationshipType } from "../schemas/person.js";
import {
  createPerson,
  deletePerson,
  getPersonById,
  listPersons,
  removeTeamFromAllPersons,
  updatePerson,
} from "../store/persons.js";
import { listAreas, getAreaById } from "../store/areas.js";
import {
  createOrganization,
  deleteOrganization,
  getOrganizationById,
  listOrganizations,
} from "../store/organizations.js";
import {
  createTeam,
  deleteTeam,
  getTeamById,
  listTeams,
  deleteTeamsByOrganizationId,
} from "../store/teams.js";
import {
  createCollection,
  deleteCollection,
  getCollectionById,
  listCollections,
  updateCollection,
} from "../store/collections.js";
import {
  createEnd,
  deleteEnd,
  getEndById,
  listEnds,
  updateEnd,
  shareEnd,
  unshareEnd,
  listSharedEnds,
  listMyShares,
} from "../store/ends.js";
import {
  createHabit,
  deleteHabit,
  getHabitById,
  listHabits,
  listHabitsWithShared,
} from "../store/habits.js";
import {
  createAction,
  deleteAction,
  deleteActionsByHabitId,
  listActions,
} from "../store/actions.js";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
} from "../store/tasks.js";
import { listUsers } from "../store/users.js";
import { interpretAndExecute } from "../services/naturalLanguage.js";

async function resolveOwnerName(ownerType: string, ownerId: string): Promise<string> {
  if (ownerType === "organization") {
    const org = await getOrganizationById(ownerId);
    return org?.name ?? ownerId;
  }
  if (ownerType === "team") {
    const team = await getTeamById(ownerId);
    return team?.name ?? ownerId;
  }
  if (ownerType === "person") {
    const person = await getPersonById(ownerId);
    return person ? `${person.firstName} ${person.lastName}` : ownerId;
  }
  return ownerId;
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    "list_areas",
    {
      title: "List Areas",
      description:
        "Lists all Wheel of Life areas (Career, Family, Health, etc.). Areas are seeded on first use.",
      inputSchema: {},
    },
    async () => {
      const areas = await listAreas();
      const lines = areas.map((a) => `  ${a.name} (${a.id})`);
      return {
        content: [
          {
            type: "text",
            text: `Areas:\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_ends_and_habits",
    {
      title: "List Ends and Habits",
      description:
        "Lists ends and habits. Filter by areaId OR collectionId (mutually exclusive). Omit both to show all areas.",
      inputSchema: {
        areaId: z.string().optional().describe("Filter to a specific area. Mutually exclusive with collectionId."),
        collectionId: z.string().optional().describe("Filter to a specific collection. Mutually exclusive with areaId."),
      },
    },
    async ({ areaId, collectionId }) => {
      if (areaId && collectionId) {
        return {
          content: [{ type: "text", text: "Provide areaId OR collectionId, not both." }],
          isError: true,
        };
      }

      const areas = await listAreas();
      const allEnds = await listEnds();
      const allHabits = await listHabits();

      if (collectionId) {
        const collection = await getCollectionById(collectionId);
        if (!collection) {
          return {
            content: [{ type: "text", text: `Collection with ID ${collectionId} not found.` }],
            isError: true,
          };
        }
        const ends = allEnds.filter((e) => e.collectionId === collectionId);
        const parts: string[] = [`## ${collection.name}`];
        for (const e of ends) {
          const habitsForEnd = allHabits.filter((h) => h.endIds.includes(e.id));
          parts.push(`  - ${e.name} (${e.id})`);
          habitsForEnd.forEach((h) => parts.push(`    - ${h.name} (${h.id})`));
        }
        if (ends.length === 0) {
          return {
            content: [{ type: "text", text: `No ends or habits in collection "${collection.name}".` }],
          };
        }
        return {
          content: [{ type: "text", text: parts.join("\n") }],
        };
      }

      const areaIdsToShow = areaId
        ? (await getAreaById(areaId) ? [areaId] : [])
        : areas.map((a) => a.id);

      if (areaId && areaIdsToShow.length === 0) {
        return {
          content: [{ type: "text", text: `Area with ID ${areaId} not found.` }],
          isError: true,
        };
      }

      const sections: string[] = [];

      for (const aId of areaIdsToShow) {
        const area = areas.find((a) => a.id === aId);
        const areaName = area?.name ?? aId;
        const ends = allEnds.filter((e) => e.areaId === aId);
        if (ends.length === 0) continue;

        const parts: string[] = [`## ${areaName}`];
        for (const e of ends) {
          const habitsForEnd = allHabits.filter((h) => h.endIds.includes(e.id));
          parts.push(`  - ${e.name} (${e.id})`);
          habitsForEnd.forEach((h) => parts.push(`    - ${h.name} (${h.id})`));
        }
        sections.push(parts.join("\n"));
      }

      const uncategorizedEnds = allEnds.filter((e) => !e.areaId);
      if (uncategorizedEnds.length > 0) {
        const parts: string[] = ["## Uncategorized"];
        for (const e of uncategorizedEnds) {
          const habitsForEnd = allHabits.filter((h) => h.endIds.includes(e.id));
          parts.push(`  - ${e.name} (${e.id})`);
          habitsForEnd.forEach((h) => parts.push(`    - ${h.name} (${h.id})`));
        }
        sections.push(parts.join("\n"));
      }

      if (sections.length === 0) {
        return {
          content: [{ type: "text", text: areaId ? "No ends or habits found for this area." : "No ends or habits found." }],
        };
      }

      return {
        content: [{ type: "text", text: sections.join("\n\n") }],
      };
    }
  );

  server.registerTool(
    "create_organization",
    {
      title: "Create Organization",
      description:
        "Creates a new organization - a container for teams and people (e.g., company, church, family).",
      inputSchema: {
        name: z.string().min(1).describe("Organization name"),
      },
    },
    async ({ name }) => {
      const org = await createOrganization({ name });
      return {
        content: [
          {
            type: "text",
            text: `Created organization: ${org.name}\nID: ${org.id}\nCreated at: ${org.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_organizations",
    {
      title: "List Organizations",
      description:
        "Lists all organizations. Use expand to show teams and people under each org.",
      inputSchema: {
        expand: z.boolean().optional().describe("If true, show teams and people under each organization"),
      },
    },
    async ({ expand }) => {
      const orgs = await listOrganizations();
      if (orgs.length === 0) {
        return {
          content: [{ type: "text", text: "No organizations found." }],
        };
      }
      if (!expand) {
        const lines = orgs.map((o) => `  ${o.name} (${o.id})`);
        return {
          content: [
            {
              type: "text",
              text: `Found ${orgs.length} organization(s):\n\n${lines.join("\n")}`,
            },
          ],
        };
      }
      const sections: string[] = [];
      for (const org of orgs) {
        const teams = await listTeams(org.id);
        const parts: string[] = [`  ${org.name} (${org.id})`, "    Teams:"];
        if (teams.length === 0) {
          parts.push("      (no teams)");
        } else {
          for (const t of teams) {
            const people = await listPersons({ teamId: t.id });
            const peopleNames = people.map((p) => `${p.firstName} ${p.lastName}`).join(", ");
            parts.push(`      - ${t.name} (${t.id})`);
            parts.push(`        ${peopleNames || "(no members)"}`);
          }
        }
        sections.push(parts.join("\n"));
      }
      return {
        content: [
          {
            type: "text",
            text: `Found ${orgs.length} organization(s):\n\n${sections.join("\n\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_organization",
    {
      title: "Delete Organization",
      description:
        "Deletes an organization by ID. Removes the organization from all persons' memberships.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the organization to delete"),
      },
    },
    async ({ id }) => {
      const org = await getOrganizationById(id);
      if (!org) {
        return {
          content: [{ type: "text", text: `Organization with ID ${id} not found.` }],
          isError: true,
        };
      }
      const teams = await listTeams(id);
      for (const t of teams) {
        await removeTeamFromAllPersons(t.id);
      }
      await deleteTeamsByOrganizationId(id);
      await deleteOrganization(id);
      return {
        content: [
          {
            type: "text",
            text: `Deleted organization: ${org.name} (${org.id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_team",
    {
      title: "Create Team",
      description:
        "Creates a new team within an organization. Teams are sub-groups (e.g., Engineering, Leadership, Kids) that people can belong to.",
      inputSchema: {
        name: z.string().min(1).describe("Team name"),
        organizationId: z.string().min(1).describe("ID of the organization this team belongs to"),
      },
    },
    async ({ name, organizationId }) => {
      const team = await createTeam({ name, organizationId });
      return {
        content: [
          {
            type: "text",
            text: `Created team: ${team.name}\nID: ${team.id}\nOrganization ID: ${team.organizationId}\nCreated at: ${team.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_teams",
    {
      title: "List Teams",
      description:
        "Lists teams. For 'list teams for [person]', 'what teams is X in?', 'teams for Alex' - use personId with that person's ID (from list_people). For 'my teams' use personId: __self__. For 'teams in Acme' use organizationId. Do NOT use organizationId when listing a specific person's teams.",
      inputSchema: {
        organizationId: z.string().optional().describe("Filter by organization ID (only when listing all teams in an org, NOT for person-specific queries)"),
        personId: z.string().optional().describe("Filter to teams this person belongs to. REQUIRED for 'list teams for [person]' - use person's ID from list_people. Use __self__ for current user."),
      },
    },
    async ({ organizationId, personId }) => {
      let teams = await listTeams(personId ? undefined : organizationId);
      if (personId) {
        const person = await getPersonById(personId);
        if (!person) {
          return {
            content: [{ type: "text", text: `Person with ID ${personId} not found.` }],
            isError: true,
          };
        }
        const memberTeamIds = new Set(person.teamIds ?? []);
        teams = teams.filter((t) => memberTeamIds.has(t.id));
      }
      if (teams.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: personId
                ? "No teams found for this person."
                : organizationId
                  ? "No teams found for this organization."
                  : "No teams found.",
            },
          ],
        };
      }
      const lines = await Promise.all(teams.map(async (t) => {
        const org = await getOrganizationById(t.organizationId);
        return `  ${t.name} (${t.id}) - Organization: ${org?.name ?? t.organizationId}`;
      }));
      return {
        content: [
          {
            type: "text",
            text: `Found ${teams.length} team(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_team",
    {
      title: "Get Team",
      description:
        "Gets a single team by ID with full details: organization, members, and their roles.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the team to fetch"),
      },
    },
    async ({ id }) => {
      const team = await getTeamById(id);
      if (!team) {
        return { content: [{ type: "text", text: `Team with ID ${id} not found.` }], isError: true };
      }
      const org = await getOrganizationById(team.organizationId);
      const members = await listPersons({ teamId: id });
      const memberLines = members.map((p) => {
        const meta: string[] = [];
        if (p.relationshipType) meta.push(p.relationshipType);
        if (p.userId) meta.push("linked account");
        return `    - ${p.firstName} ${p.lastName}${meta.length ? ` [${meta.join(", ")}]` : ""}`;
      });
      const parts = [
        `${team.name} (${team.id})`,
        org && `  Organization: ${org.name}`,
        `  Created: ${team.createdAt}`,
        members.length > 0 ? `  Members:\n${memberLines.join("\n")}` : "  Members: (none)",
      ].filter(Boolean);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "delete_team",
    {
      title: "Delete Team",
      description:
        "Deletes a team by ID. Removes the team from all persons' memberships.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the team to delete"),
      },
    },
    async ({ id }) => {
      const team = await getTeamById(id);
      if (!team) {
        return {
          content: [{ type: "text", text: `Team with ID ${id} not found.` }],
          isError: true,
        };
      }
      await removeTeamFromAllPersons(id);
      await deleteTeam(id);
      return {
        content: [
          {
            type: "text",
            text: `Deleted team: ${team.name} (${team.id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_collection",
    {
      title: "Create Collection",
      description:
        "Creates a collection - a grouping of ends under an org, team, or person. Enables the view: (org/team/person) -> collection -> ends -> habits.",
      inputSchema: {
        name: z.string().min(1).describe("Collection name"),
        ownerType: z
          .enum(["organization", "team", "person"])
          .describe("Type of owner (org, team, or person)"),
        ownerId: z.string().min(1).describe("ID of the organization, team, or person"),
        collectionType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Type of collection (goals, projects, quarterly, backlog, other)"),
        description: z.string().optional().describe("Optional description"),
      },
    },
    async ({ name, ownerType, ownerId, collectionType, description }) => {
      const collection = await createCollection({
        name,
        ownerType,
        ownerId,
        collectionType,
        description,
      });
      return {
        content: [
          {
            type: "text",
            text: `Created collection: ${collection.name}\nID: ${collection.id}\nOwner: ${collection.ownerType} ${collection.ownerId}\n${collection.collectionType ? `Type: ${collection.collectionType}\n` : ""}${collection.description ? `Description: ${collection.description}\n` : ""}Created at: ${collection.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_collections",
    {
      title: "List Collections",
      description:
        "Lists collections. Filter by owner (ownerType + ownerId) or by collectionType.",
      inputSchema: {
        ownerType: z
          .enum(["organization", "team", "person"])
          .optional()
          .describe("Filter by owner type"),
        ownerId: z.string().optional().describe("Filter by owner ID"),
        collectionType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Filter by collection type"),
      },
    },
    async ({ ownerType, ownerId, collectionType }) => {
      const collections = await listCollections(
        ownerType || ownerId || collectionType
          ? { ownerType, ownerId, collectionType }
          : undefined
      );
      if (collections.length === 0) {
        return { content: [{ type: "text", text: "No collections found." }] };
      }
      const lines = await Promise.all(collections.map(async (c) => {
        const ownerName = await resolveOwnerName(c.ownerType, c.ownerId);
        return `  ${c.name} (${c.id}) - ${c.ownerType}: ${ownerName}${c.collectionType ? ` [${c.collectionType}]` : ""}`;
      }));
      return {
        content: [
          {
            type: "text",
            text: `Found ${collections.length} collection(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_collection",
    {
      title: "Get Collection",
      description:
        "Gets a single collection by ID with full details: owner, type, and the ends it contains.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the collection to fetch"),
      },
    },
    async ({ id }) => {
      const collection = await getCollectionById(id);
      if (!collection) {
        return { content: [{ type: "text", text: `Collection with ID ${id} not found.` }], isError: true };
      }
      const ownerName = await resolveOwnerName(collection.ownerType, collection.ownerId);
      const allEnds = await listEnds();
      const ends = allEnds.filter((e) => e.collectionId === id);
      const endLines = ends.map((e) => `    - ${e.name} (${e.id})`);
      const parts = [
        `${collection.name} (${collection.id})`,
        `  Owner: ${ownerName} (${collection.ownerType})`,
        collection.collectionType && `  Type: ${collection.collectionType}`,
        collection.description && `  Description: ${collection.description}`,
        `  Created: ${collection.createdAt}`,
        ends.length > 0 ? `  Ends:\n${endLines.join("\n")}` : "  Ends: (none)",
      ].filter(Boolean);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "update_collection",
    {
      title: "Update Collection",
      description: "Updates a collection by ID. Only provided fields are updated.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the collection to update"),
        name: z.string().min(1).optional().describe("Collection name"),
        collectionType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Collection type"),
        description: z.string().optional().describe("Description"),
      },
    },
    async ({ id, name, collectionType, description }) => {
      const existing = await getCollectionById(id);
      if (!existing) {
        return {
          content: [{ type: "text", text: `Collection with ID ${id} not found.` }],
          isError: true,
        };
      }
      const updates: Record<string, unknown> = {};
      if (name != null) updates.name = name;
      if (collectionType !== undefined) updates.collectionType = collectionType;
      if (description !== undefined) updates.description = description;
      const collection = await updateCollection(id, updates);
      return {
        content: [
          {
            type: "text",
            text: `Updated collection: ${collection?.name} (${id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_collection",
    {
      title: "Delete Collection",
      description:
        "Deletes a collection by ID. Ends in the collection are not deleted; their collectionId is not automatically cleared.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the collection to delete"),
      },
    },
    async ({ id }) => {
      const collection = await getCollectionById(id);
      if (!collection) {
        return {
          content: [{ type: "text", text: `Collection with ID ${id} not found.` }],
          isError: true,
        };
      }
      await deleteCollection(id);
      return {
        content: [
          {
            type: "text",
            text: `Deleted collection: ${collection.name} (${id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_end",
    {
      title: "Create End",
      description:
        "Creates an end - an ongoing aspiration you work toward (e.g., Be a better father, Practice guitar).",
      inputSchema: {
        name: z.string().min(1).describe("Name of the end"),
        areaId: z.string().optional().describe("Area this end belongs to"),
        collectionId: z.string().optional().describe("Collection this end belongs to"),
      },
    },
    async ({ name, areaId, collectionId }) => {
      const end = await createEnd({ name, areaId, collectionId });
      return {
        content: [
          {
            type: "text",
            text: `Created end: ${end.name}\nID: ${end.id}\n${end.areaId ? `Area: ${end.areaId}\n` : ""}${end.collectionId ? `Collection: ${end.collectionId}\n` : ""}Created at: ${end.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_ends",
    {
      title: "List Ends",
      description: "Lists ends. Optionally filter by area ID or collection ID.",
      inputSchema: {
        areaId: z.string().optional().describe("Filter by area ID"),
        collectionId: z.string().optional().describe("Filter by collection ID"),
      },
    },
    async ({ areaId, collectionId }) => {
      const ends = await listEnds(areaId || collectionId ? { areaId, collectionId } : undefined);
      if (ends.length === 0) {
        return { content: [{ type: "text", text: "No ends found." }] };
      }
      const allAreas = await listAreas();
      const allCollections = await listCollections();
      const lines = ends.map((e) => {
        const area = e.areaId ? allAreas.find((a) => a.id === e.areaId) : undefined;
        const collection = e.collectionId ? allCollections.find((c) => c.id === e.collectionId) : undefined;
        return `  ${e.name} (${e.id})${area ? ` - Area: ${area.name}` : ""}${collection ? ` - Collection: ${collection.name}` : ""}`;
      });
      return {
        content: [
          {
            type: "text",
            text: `Found ${ends.length} end(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_end",
    {
      title: "Get End",
      description:
        "Gets a single end by ID with full details: area, collection, habits (with participants), and sharing info.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the end to fetch"),
      },
    },
    async ({ id }) => {
      const end = await getEndById(id);
      if (!end) {
        return { content: [{ type: "text", text: `End with ID ${id} not found.` }], isError: true };
      }
      const area = end.areaId ? await getAreaById(end.areaId) : undefined;
      const collections = await listCollections();
      const collection = end.collectionId ? collections.find((c) => c.id === end.collectionId) : undefined;
      const habits = await listHabits({ endId: id });
      const habitLines: string[] = [];
      for (const h of habits) {
        const personNames: string[] = [];
        for (const pid of h.personIds ?? []) {
          const person = await getPersonById(pid);
          personNames.push(person ? `${person.firstName} ${person.lastName}` : pid);
        }
        const meta: string[] = [];
        if (h.frequency) meta.push(h.frequency);
        if (personNames.length) meta.push(`participants: ${personNames.join(", ")}`);
        habitLines.push(`    - ${h.name} (${h.id})${meta.length ? ` [${meta.join(", ")}]` : ""}`);
      }
      const shares = await listMyShares();
      const endShares = shares.filter((s) => s.endId === id);
      const shareLines = endShares.map((s) => `    - ${s.sharedWithEmail}`);
      const parts = [
        `${end.name} (${end.id})`,
        area && `  Area: ${area.name}`,
        collection && `  Collection: ${collection.name}`,
        `  Created: ${end.createdAt}`,
        habits.length > 0 ? `  Habits:\n${habitLines.join("\n")}` : "  Habits: (none)",
        shareLines.length > 0 ? `  Shared with:\n${shareLines.join("\n")}` : undefined,
      ].filter(Boolean);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "update_end",
    {
      title: "Update End",
      description:
        "Updates an end by ID. Only provided fields are updated. Use to add an end to a collection, change its area, or rename it.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the end to update"),
        name: z.string().min(1).optional().describe("End name"),
        areaId: z.string().optional().describe("Area this end belongs to"),
        collectionId: z.string().optional().describe("Collection this end belongs to"),
      },
    },
    async ({ id, name, areaId, collectionId }) => {
      const existing = await getEndById(id);
      if (!existing) {
        return {
          content: [{ type: "text", text: `End with ID ${id} not found.` }],
          isError: true,
        };
      }
      const updates: Record<string, unknown> = {};
      if (name != null) updates.name = name;
      if (areaId !== undefined) updates.areaId = areaId;
      if (collectionId !== undefined) updates.collectionId = collectionId;
      const end = await updateEnd(id, updates);
      return {
        content: [
          {
            type: "text",
            text: `Updated end: ${end?.name} (${id})${end?.collectionId ? ` - Collection: ${end.collectionId}` : ""}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_end",
    {
      title: "Delete End",
      description: "Deletes an end by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the end to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deleteEnd(id);
      if (!deleted) {
        return {
          content: [{ type: "text", text: `End with ID ${id} not found.` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Deleted end: ${deleted.name} (${deleted.id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_habit",
    {
      title: "Create Habit",
      description:
        "Creates a habit - a recurring behavior that serves ends. Generates actions that can be tracked.",
      inputSchema: {
        name: z.string().min(1).describe("Name of the habit"),
        endIds: z.array(z.string()).min(1).describe("IDs of ends this habit serves"),
        areaId: z.string().optional(),
        teamId: z.string().optional(),
        personIds: z.array(z.string()).optional().describe("IDs of people who participate in the habit"),
        frequency: z.string().optional().describe("e.g. daily, weekly, 3x/week"),
        durationMinutes: z.number().int().positive().optional().describe("Estimated time in minutes"),
      },
    },
    async ({ name, endIds, areaId, teamId, personIds, frequency, durationMinutes }) => {
      const habit = await createHabit({
        name,
        endIds,
        areaId,
        teamId,
        personIds,
        frequency,
        durationMinutes,
      });
      const parts = [
        `Created habit: ${habit.name}`,
        `ID: ${habit.id}`,
        `Ends: ${habit.endIds.join(", ")}`,
        habit.areaId && `Area: ${habit.areaId}`,
        habit.teamId && `Team: ${habit.teamId}`,
        habit.personIds?.length && `Participants: ${habit.personIds.join(", ")}`,
        habit.frequency && `Frequency: ${habit.frequency}`,
        habit.durationMinutes != null && `Duration: ${habit.durationMinutes} min`,
        `Created at: ${habit.createdAt}`,
      ].filter(Boolean);
      return {
        content: [{ type: "text", text: parts.join("\n") }],
      };
    }
  );

  server.registerTool(
    "list_habits",
    {
      title: "List Habits",
      description:
        "Lists habits. Optionally filter by end, area, organization, or person.",
      inputSchema: {
        endId: z.string().optional().describe("Filter by end ID"),
        areaId: z.string().optional().describe("Filter by area ID"),
        teamId: z.string().optional().describe("Filter by team ID"),
        personId: z.string().optional().describe("Filter by person who performs the habit"),
      },
    },
    async ({ endId, areaId, teamId, personId }) => {
      const habits = await listHabits({
        endId,
        areaId,
        teamId,
        personId,
      });
      if (habits.length === 0) {
        return { content: [{ type: "text", text: "No habits found." }] };
      }
      const lines = habits.map((h) => {
        const meta: string[] = [];
        if (h.frequency) meta.push(h.frequency);
        if (h.durationMinutes != null) meta.push(`${h.durationMinutes} min`);
        if (h.areaId) meta.push(`area: ${h.areaId}`);
        if (h.teamId) meta.push(`team: ${h.teamId}`);
        if (h.personIds?.length) meta.push(`persons: ${h.personIds.join(", ")}`);
        return `  ${h.name} (${h.id})\n    Ends: ${h.endIds.join(", ")}${meta.length ? ` | ${meta.join(", ")}` : ""}`;
      });
      return {
        content: [
          {
            type: "text",
            text: `Found ${habits.length} habit(s):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_habit",
    {
      title: "Get Habit",
      description:
        "Gets a single habit by ID with full details: ends, area, team, participants, frequency, and recent actions.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the habit to fetch"),
      },
    },
    async ({ id }) => {
      const habit = await getHabitById(id);
      if (!habit) {
        return { content: [{ type: "text", text: `Habit with ID ${id} not found.` }], isError: true };
      }
      const ends = await listEnds({ includeShared: true });
      const endNames = habit.endIds.map((eid) => ends.find((e) => e.id === eid)?.name ?? eid);
      const personNames: string[] = [];
      for (const pid of habit.personIds ?? []) {
        const person = await getPersonById(pid);
        personNames.push(person ? `${person.firstName} ${person.lastName}` : pid);
      }
      const area = habit.areaId ? await getAreaById(habit.areaId) : undefined;
      const team = habit.teamId ? await getTeamById(habit.teamId) : undefined;
      const actions = await listActions({ habitId: id });
      const recentActions = actions.slice(0, 5);

      const parts = [
        `${habit.name} (${habit.id})`,
        `  Ends: ${endNames.join(", ")}`,
        area && `  Area: ${area.name}`,
        team && `  Team: ${team.name}`,
        personNames.length > 0 && `  Participants: ${personNames.join(", ")}`,
        habit.frequency && `  Frequency: ${habit.frequency}`,
        habit.durationMinutes != null && `  Duration: ${habit.durationMinutes} min`,
        `  Created: ${habit.createdAt}`,
      ].filter(Boolean);

      if (recentActions.length > 0) {
        parts.push("  Recent actions:");
        for (const a of recentActions) {
          const extra = a.actualDurationMinutes != null ? ` (${a.actualDurationMinutes} min)` : "";
          parts.push(`    - ${a.completedAt.slice(0, 10)}${extra}`);
        }
      } else {
        parts.push("  Recent actions: (none)");
      }

      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "delete_habit",
    {
      title: "Delete Habit",
      description:
        "Deletes a habit by ID. Also deletes all tracked actions for this habit.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the habit to delete"),
      },
    },
    async ({ id }) => {
      const habit = await getHabitById(id);
      if (!habit) {
        return {
          content: [{ type: "text", text: `Habit with ID ${id} not found.` }],
          isError: true,
        };
      }
      const actionsDeleted = await deleteActionsByHabitId(id);
      await deleteHabit(id);
      return {
        content: [
          {
            type: "text",
            text: `Deleted habit: ${habit.name} (${habit.id})${actionsDeleted > 0 ? ` and ${actionsDeleted} action(s)` : ""}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_action",
    {
      title: "Create Action",
      description:
        "Records a completed habit action (e.g., practiced guitar on Feb 24). Use withPersonIds for shared experience, forPersonIds for acts of service.",
      inputSchema: {
        habitId: z.string().min(1).describe("ID of the habit"),
        completedAt: z.string().describe("ISO date when completed (e.g. 2026-02-24)"),
        actualDurationMinutes: z.number().int().positive().optional().describe("Actual time spent in minutes"),
        notes: z.string().optional(),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs - did it with (shared experience)"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs - did it for (acts of service)"),
      },
    },
    async ({ habitId, completedAt, actualDurationMinutes, notes, withPersonIds, forPersonIds }) => {
      const action = await createAction({
        habitId,
        completedAt,
        actualDurationMinutes,
        notes,
        withPersonIds,
        forPersonIds,
      });
      const habit = await getHabitById(habitId);
      const extras: string[] = [];
      if (withPersonIds?.length) extras.push(`With: ${withPersonIds.join(", ")}`);
      if (forPersonIds?.length) extras.push(`For: ${forPersonIds.join(", ")}`);
      return {
        content: [
          {
            type: "text",
            text: `Recorded action: ${habit?.name ?? habitId} on ${completedAt.slice(0, 10)}\nID: ${action.id}\n${actualDurationMinutes != null ? `Actual duration: ${actualDurationMinutes} min\n` : ""}${notes ? `Notes: ${notes}\n` : ""}${extras.length ? extras.join("\n") + "\n" : ""}Created at: ${action.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_actions",
    {
      title: "List Actions",
      description:
        "Lists tracked actions. Use period (today, yesterday, this_week) or fromDate/toDate. Optionally filter by habit.",
      inputSchema: {
        habitId: z.string().optional().describe("Filter by habit ID"),
        period: z
          .enum(["today", "yesterday", "this_week"])
          .optional()
          .describe("Convenience: today, yesterday, or this_week (Mon-Sun)"),
        fromDate: z.string().optional().describe("From date (YYYY-MM-DD). Ignored if period is set."),
        toDate: z.string().optional().describe("To date (YYYY-MM-DD). Ignored if period is set."),
      },
    },
    async ({ habitId, period, fromDate, toDate }) => {
      let resolvedFrom = fromDate;
      let resolvedTo = toDate;
      if (period) {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
        if (period === "today") {
          resolvedFrom = resolvedTo = today;
        } else if (period === "yesterday") {
          resolvedFrom = resolvedTo = yesterday;
        } else if (period === "this_week") {
          const day = now.getDay();
          const mondayOffset = day === 0 ? -6 : 1 - day;
          const monday = new Date(now);
          monday.setDate(now.getDate() + mondayOffset);
          resolvedFrom = monday.toISOString().slice(0, 10);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          resolvedTo = sunday.toISOString().slice(0, 10);
        }
      }
      const actions = await listActions({ habitId, fromDate: resolvedFrom, toDate: resolvedTo });
      if (actions.length === 0) {
        const periodLabel = period ? ` for ${period.replace("_", " ")}` : "";
        return { content: [{ type: "text", text: `No actions found${periodLabel}.` }] };
      }
      const lines = await Promise.all(
        actions.map(async (a) => {
          const habit = await getHabitById(a.habitId);
          const parts = [
            `  ${habit?.name ?? a.habitId} - ${a.completedAt.slice(0, 10)} (${a.id})`,
            a.actualDurationMinutes != null ? `${a.actualDurationMinutes} min` : null,
            a.notes ? a.notes : null,
            a.withPersonIds?.length
              ? `with: ${(await Promise.all(a.withPersonIds.map(async (pid) => { const p = await getPersonById(pid); return p ? `${p.firstName} ${p.lastName}` : pid; }))).join(", ")}`
              : null,
            a.forPersonIds?.length
              ? `for: ${(await Promise.all(a.forPersonIds.map(async (pid) => { const p = await getPersonById(pid); return p ? `${p.firstName} ${p.lastName}` : pid; }))).join(", ")}`
              : null,
          ].filter(Boolean);
          return parts.join(" | ");
        })
      );
      return {
        content: [
          {
            type: "text",
            text: `Found ${actions.length} action(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_action",
    {
      title: "Delete Action",
      description: "Deletes a tracked action by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the action to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deleteAction(id);
      if (!deleted) {
        return {
          content: [{ type: "text", text: `Action with ID ${id} not found.` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Deleted action (${deleted.id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description:
        "Creates an ad-hoc task (e.g., Call mom this week, Get oil changed). Use withPersonIds/forPersonIds for reflection.",
      inputSchema: {
        name: z.string().min(1).describe("Task name"),
        endId: z.string().optional().describe("End this task supports"),
        areaId: z.string().optional().describe("Area this task belongs to"),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs - did it with"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs - did it for"),
        dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
        notes: z.string().optional(),
      },
    },
    async ({ name, endId, areaId, withPersonIds, forPersonIds, dueDate, notes }) => {
      const task = await createTask({
        name,
        endId,
        areaId,
        withPersonIds,
        forPersonIds,
        dueDate,
        notes,
      });
      return {
        content: [
          {
            type: "text",
            text: `Created task: ${task.name} (${task.id})\n${endId ? `End: ${endId}\n` : ""}${areaId ? `Area: ${areaId}\n` : ""}${dueDate ? `Due: ${dueDate}\n` : ""}Created at: ${task.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: "Lists tasks. Filter by end, area, or completion status.",
      inputSchema: {
        endId: z.string().optional().describe("Filter by end ID"),
        areaId: z.string().optional().describe("Filter by area ID"),
        completed: z.boolean().optional().describe("Filter: true = completed only, false = open only"),
      },
    },
    async ({ endId, areaId, completed }) => {
      const tasks = await listTasks({ endId, areaId, completed });
      if (tasks.length === 0) {
        return { content: [{ type: "text", text: "No tasks found." }] };
      }
      const lines = tasks.map((t) => {
        const status = t.completedAt ? `✓ ${t.completedAt.slice(0, 10)}` : "open";
        const parts = [
          `  ${t.name} (${t.id}) [${status}]`,
          t.endId ? `end:${t.endId}` : null,
          t.areaId ? `area:${t.areaId}` : null,
          t.dueDate ? `due:${t.dueDate}` : null,
          t.actualDurationMinutes != null ? `${t.actualDurationMinutes} min` : null,
          t.withPersonIds?.length ? `with: ${t.withPersonIds.join(", ")}` : null,
          t.forPersonIds?.length ? `for: ${t.forPersonIds.join(", ")}` : null,
        ].filter(Boolean);
        return parts.join(" | ");
      });
      return {
        content: [
          {
            type: "text",
            text: `Found ${tasks.length} task(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_task",
    {
      title: "Get Task",
      description: "Gets a single task by ID with full details.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task to fetch"),
      },
    },
    async ({ id }) => {
      const task = await getTaskById(id);
      if (!task) {
        return { content: [{ type: "text", text: `Task with ID ${id} not found.` }], isError: true };
      }
      const area = task.areaId ? await getAreaById(task.areaId) : undefined;
      const end = task.endId ? await getEndById(task.endId) : undefined;
      const parts = [
        `${task.name} (${task.id})`,
        task.completedAt ? `  Status: completed ${task.completedAt.slice(0, 10)}` : "  Status: open",
        end && `  End: ${end.name}`,
        area && `  Area: ${area.name}`,
        task.dueDate && `  Due: ${task.dueDate}`,
        task.actualDurationMinutes != null && `  Duration: ${task.actualDurationMinutes} min`,
        task.notes && `  Notes: ${task.notes}`,
        `  Created: ${task.createdAt}`,
      ].filter(Boolean);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description: "Updates a task. Use to complete (completedAt, actualDurationMinutes), change details, or add with/for.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task to update"),
        name: z.string().min(1).optional().describe("Task name"),
        endId: z.string().optional().describe("End ID"),
        areaId: z.string().optional().describe("Area ID"),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs - did it with"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs - did it for"),
        actualDurationMinutes: z.number().int().positive().optional().describe("Time spent when completed (minutes)"),
        dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
        completedAt: z.string().optional().describe("When completed (ISO). Set to mark complete."),
        notes: z.string().optional(),
      },
    },
    async ({ id, name, endId, areaId, withPersonIds, forPersonIds, actualDurationMinutes, dueDate, completedAt, notes }) => {
      const existing = await getTaskById(id);
      if (!existing) {
        return {
          content: [{ type: "text", text: `Task with ID ${id} not found.` }],
          isError: true,
        };
      }
      const updates: Record<string, unknown> = {};
      if (name != null) updates.name = name;
      if (endId !== undefined) updates.endId = endId;
      if (areaId !== undefined) updates.areaId = areaId;
      if (withPersonIds !== undefined) updates.withPersonIds = withPersonIds;
      if (forPersonIds !== undefined) updates.forPersonIds = forPersonIds;
      if (actualDurationMinutes !== undefined) updates.actualDurationMinutes = actualDurationMinutes;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (completedAt !== undefined) updates.completedAt = completedAt;
      if (notes !== undefined) updates.notes = notes;
      const task = await updateTask(id, updates as Parameters<typeof updateTask>[1]);
      return {
        content: [
          {
            type: "text",
            text: `Updated task: ${task?.name} (${id})${task?.completedAt ? " - completed" : ""}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: "Deletes a task by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deleteTask(id);
      if (!deleted) {
        return {
          content: [{ type: "text", text: `Task with ID ${id} not found.` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Deleted task: ${deleted.name} (${id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_person",
    {
      title: "Create Person",
      description:
        "Creates a new person entity. Check list_people or get_person first to avoid duplicates; if the person exists, use update_person to add them to new groups instead.",
      inputSchema: {
        firstName: z.string().min(1).describe("First name of the person"),
        lastName: z.string().min(1).describe("Last name of the person"),
        email: z.string().email().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        title: z.string().optional().describe("Job title or role"),
        notes: z.string().optional().describe("Additional notes about the person"),
        teamIds: z
          .array(z.string())
          .optional()
          .describe("IDs of teams this person belongs to"),
        relationshipType: z
          .enum(["self", "spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Type of relationship (e.g. spouse, child, friend, colleague)"),
        userId: z.string().optional().describe("Link to User when this Person has an account"),
      },
    },
    async ({ firstName, lastName, email, phone, title, notes, teamIds, relationshipType, userId }) => {
      const person = await createPerson({
        firstName,
        lastName,
        email,
        phone,
        title,
        notes,
        teamIds: teamIds ?? [],
        relationshipType: relationshipType as RelationshipType | undefined,
        userId,
      });

      const summary = [
        `Created person: ${person.firstName} ${person.lastName}`,
        `ID: ${person.id}`,
        `Email: ${person.email}`,
        person.phone && `Phone: ${person.phone}`,
        person.title && `Title: ${person.title}`,
        person.notes && `Notes: ${person.notes}`,
        person.relationshipType && `Relationship: ${person.relationshipType}`,
        person.teamIds?.length && `Teams: ${person.teamIds.join(", ")}`,
        `Created at: ${person.createdAt}`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_person",
    {
      title: "Get Person",
      description:
        "Gets a single person by ID with full details (teams, relationship, etc.). Use to verify a person exists or fetch their details before update_person.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to fetch"),
      },
    },
    async ({ id }) => {
      const person = await getPersonById(id);
      if (!person) {
        return {
          content: [{ type: "text", text: `Person with ID ${id} not found.` }],
          isError: true,
        };
      }
      const teamNames: string[] = [];
      for (const tId of person.teamIds ?? []) {
        const team = await getTeamById(tId);
        teamNames.push(team?.name ?? tId);
      }
      const parts = [
        `${person.firstName} ${person.lastName} (${person.id})`,
        `  Email: ${person.email}`,
        person.phone && `  Phone: ${person.phone}`,
        person.title && `  Title: ${person.title}`,
        person.relationshipType && `  Relationship: ${person.relationshipType}`,
        teamNames.length > 0 && `  Teams: ${teamNames.join(", ")}`,
        `  Created: ${person.createdAt}`,
      ].filter(Boolean);
      return {
        content: [{ type: "text", text: parts.join("\n") }],
      };
    }
  );

  server.registerTool(
    "list_people",
    {
      title: "List People",
      description:
        "Lists people. Optionally filter by organization ID, team ID, or relationship type.",
      inputSchema: {
        organizationId: z.string().optional().describe("Filter by organization ID"),
        teamId: z.string().optional().describe("Filter by team ID"),
        relationshipType: z
          .enum(["self", "spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Filter by relationship type"),
      },
    },
    async ({ organizationId, teamId, relationshipType }) => {
      const people = await listPersons({ organizationId, teamId, relationshipType });

      if (people.length === 0) {
        return {
          content: [{ type: "text", text: "No people found." }],
        };
      }

      const lines = await Promise.all(
        people.map(async (p) => {
          const teamNames: string[] = [];
          for (const tId of p.teamIds ?? []) {
            const team = await getTeamById(tId);
            teamNames.push(team?.name ?? tId);
          }
          const parts = [
            `${p.firstName} ${p.lastName} (${p.id})`,
            `  Email: ${p.email}`,
            p.userId && `  User ID: ${p.userId}`,
            p.phone && `  Phone: ${p.phone}`,
            p.title && `  Title: ${p.title}`,
            p.relationshipType && `  Relationship: ${p.relationshipType}`,
            teamNames.length > 0 && `  Teams: ${teamNames.join(", ")}`,
            `  Created: ${p.createdAt}`,
          ].filter(Boolean);
          return parts.join("\n");
        })
      );

      return {
        content: [
          {
            type: "text",
            text: `Found ${people.length} person(s):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_users",
    {
      title: "List Users",
      description:
        "Lists users (account holders). For testing Person vs User linkage: Person.id is the representation; User.id is the account. When Person.userId is set, that Person is linked to this User.",
      inputSchema: {},
    },
    async () => {
      const users = await listUsers();
      if (users.length === 0) {
        return {
          content: [{ type: "text", text: "No users found." }],
        };
      }
      const lines = users.map((u) => `  ${u.displayName} (${u.id}) - ${u.email}`);
      return {
        content: [
          {
            type: "text",
            text: `Found ${users.length} user(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "update_person",
    {
      title: "Update Person",
      description:
        "Updates an existing person by ID. Use get_person or list_people to find the person. To add a person to new teams, use teamIdsToAdd (merges with existing). Use teamIds only to replace the entire list.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to update"),
        firstName: z.string().min(1).optional().describe("First name"),
        lastName: z.string().min(1).optional().describe("Last name"),
        email: z.string().email().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        title: z.string().optional().describe("Job title or role"),
        notes: z.string().optional().describe("Additional notes"),
        teamIds: z.array(z.string()).optional().describe("Team IDs (replaces entire list)"),
        teamIdsToAdd: z.array(z.string()).optional().describe("Team IDs to add (merges with existing; use when adding person to new teams)"),
        relationshipType: z
          .enum(["self", "spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Relationship type"),
        userId: z.string().optional().describe("Link to User when this Person has an account"),
      },
    },
    async ({ id, firstName, lastName, email, phone, title, notes, teamIds, teamIdsToAdd, relationshipType, userId }) => {
      const existing = await getPersonById(id);
      if (!existing) {
        return {
          content: [{ type: "text", text: `Person with ID ${id} not found.` }],
          isError: true,
        };
      }
      const updates: Record<string, unknown> = {};
      if (firstName != null) updates.firstName = firstName;
      if (lastName != null) updates.lastName = lastName;
      if (email != null) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (title !== undefined) updates.title = title;
      if (notes !== undefined) updates.notes = notes;
      if (teamIds !== undefined) updates.teamIds = teamIds;
      if (teamIdsToAdd !== undefined) updates.teamIdsToAdd = teamIdsToAdd;
      if (relationshipType !== undefined) updates.relationshipType = relationshipType;
      if (userId !== undefined) updates.userId = userId;
      const person = await updatePerson(id, updates as Parameters<typeof updatePerson>[1]);
      if (!person) {
        return {
          content: [{ type: "text", text: `Person with ID ${id} not found.` }],
          isError: true,
        };
      }
      const summary = [
        `Updated person: ${person.firstName} ${person.lastName}`,
        `ID: ${person.id}`,
        person.phone && `Phone: ${person.phone}`,
        person.title && `Title: ${person.title}`,
        person.notes && `Notes: ${person.notes}`,
        person.relationshipType && `Relationship: ${person.relationshipType}`,
        person.teamIds?.length && `Teams: ${person.teamIds.join(", ")}`,
      ].filter(Boolean).join("\n");
      return {
        content: [{ type: "text", text: summary }],
      };
    }
  );

  server.registerTool(
    "delete_person",
    {
      title: "Delete Person",
      description: "Deletes a person by ID. Returns the deleted person's details or an error if not found.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deletePerson(id);
      if (!deleted) {
        return {
          content: [
            {
              type: "text",
              text: `Person with ID ${id} not found.`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Deleted person: ${deleted.firstName} ${deleted.lastName} (${deleted.id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "natural_language_command",
    {
      title: "Natural Language Command",
      description:
        "Interpret natural language and execute the appropriate action. Examples: 'I went to the gym today for 60 minutes', 'I want to be a better father', 'What habits would help me be a better father?', 'Create an Engineering team in Newco', 'Add my wife Jennifer, jennifer@example.com'.",
      inputSchema: {
        text: z.string().min(1).describe("Natural language input from the user"),
      },
    },
    async ({ text }) => {
      const result = await interpretAndExecute(text);
      return {
        content: [{ type: "text", text: result.message }],
        isError: !result.success,
      };
    }
  );

  // ============================================================================
  // SHARING TOOLS
  // ============================================================================

  server.registerTool(
    "share_end",
    {
      title: "Share End",
      description:
        "Share an end (aspiration) with another user by their user ID. The shared user will have read-only access to the end and its habits/actions.",
      inputSchema: {
        endId: z.string().min(1).describe("ID of the end to share"),
        sharedWithUserId: z.string().min(1).describe("User ID of the person to share with"),
      },
    },
    async ({ endId, sharedWithUserId }) => {
      try {
        const share = await shareEnd(endId, sharedWithUserId);
        return {
          content: [
            {
              type: "text",
              text: `Shared "${share.endName}" with ${share.sharedWithEmail}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to share: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "unshare_end",
    {
      title: "Unshare End",
      description:
        "Remove sharing of an end with a user. You can unshare ends you own, or remove yourself from ends shared with you.",
      inputSchema: {
        endId: z.string().min(1).describe("ID of the end to unshare"),
        userId: z.string().min(1).describe("ID of the user to remove sharing for"),
      },
    },
    async ({ endId, userId }) => {
      try {
        const removed = await unshareEnd(endId, userId);
        if (removed) {
          return {
            content: [{ type: "text", text: "Sharing removed successfully." }],
          };
        } else {
          return {
            content: [{ type: "text", text: "Share not found." }],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to unshare: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_shared_ends",
    {
      title: "List Shared Ends",
      description:
        "Lists ends that have been shared with you by other users. These are read-only ends you can track progress on together.",
      inputSchema: {},
    },
    async () => {
      const ends = await listSharedEnds();
      if (ends.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No ends have been shared with you.",
            },
          ],
        };
      }
      const lines = ends.map(
        (e) => `  ${e.name} (${e.id}) - shared by ${e.ownerDisplayName ?? "Unknown"}`
      );
      return {
        content: [
          {
            type: "text",
            text: `Ends shared with you:\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_shared_habits",
    {
      title: "List Shared Habits",
      description: "Lists habits shared with you through shared ends, showing the owner and linked ends.",
      inputSchema: {},
    },
    async () => {
      const habits = await listHabitsWithShared();
      const shared = habits.filter((h) => h.isShared);
      if (shared.length === 0) {
        return { content: [{ type: "text", text: "No shared habits found." }] };
      }
      const allEnds = await listEnds({ includeShared: true });
      const lines = shared.map((h) => {
        const endNames = h.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid).join(", ");
        return `  ${h.name} (${h.id}) → serves: ${endNames} — shared by ${h.ownerDisplayName ?? "Unknown"}`;
      });
      return { content: [{ type: "text", text: `Shared habits:\n\n${lines.join("\n")}` }] };
    }
  );

  server.registerTool(
    "list_my_shares",
    {
      title: "List My Shares",
      description: "Lists ends you have shared with other users.",
      inputSchema: {},
    },
    async () => {
      const shares = await listMyShares();
      if (shares.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "You haven't shared any ends with others.",
            },
          ],
        };
      }
      const lines = shares.map(
        (s) =>
          `  ${s.endName} (${s.endId}) — shared with ${s.sharedWithEmail}`
      );
      return {
        content: [
          {
            type: "text",
            text: `Your shared ends:\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );
}
