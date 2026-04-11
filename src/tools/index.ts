/**
 * MCP Tools - Functions callable by the LLM
 *
 * Add your tool implementations here. Each tool receives validated
 * arguments and returns content for the client.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RelationshipType } from "../schemas/person.js";
import { getSupabase } from "../store/base.js";
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
  createPortfolio,
  deletePortfolio,
  getPortfolioById,
  listPortfolios,
  updatePortfolio,
} from "../store/portfolios.js";
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
  updateHabit,
  updateHabitEnds,
  updateHabitPersons,
  addHabitPersons,
  removeHabitPersons,
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
  // --- Beliefs ---

  server.registerTool(
    "list_beliefs",
    {
      title: "List Beliefs",
      description: "Lists core beliefs with their linked ends.",
      inputSchema: {},
    },
    async () => {
      const { listBeliefs } = await import("../store/beliefs.js");
      const beliefs = await listBeliefs();
      if (beliefs.length === 0) {
        return { content: [{ type: "text", text: "No beliefs found." }] };
      }
      const allEnds = await listEnds();
      const lines = beliefs.map((b) => {
        const endNames = b.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid);
        const endsPart = endNames.length > 0 ? `\n    Linked ends: ${endNames.join(", ")}` : "";
        return `  ${b.name} (${b.id})${endsPart}`;
      });
      return { content: [{ type: "text", text: `Beliefs:\n\n${lines.join("\n")}` }] };
    }
  );

  server.registerTool(
    "get_belief",
    {
      title: "Get Belief",
      description: "Gets a single belief by ID with full details and linked ends.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the belief to fetch"),
      },
    },
    async ({ id }) => {
      const { getBeliefById } = await import("../store/beliefs.js");
      const belief = await getBeliefById(id);
      if (!belief) {
        return { content: [{ type: "text", text: `Belief with ID ${id} not found.` }], isError: true };
      }
      const allEnds = await listEnds();
      const endNames = belief.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid);
      const parts = [
        `${belief.name} (${belief.id})`,
        belief.description && `  Description: ${belief.description}`,
        `  Created: ${belief.createdAt}`,
        endNames.length > 0 ? `  Linked ends:\n${endNames.map((n) => `    - ${n}`).join("\n")}` : "  Linked ends: (none)",
      ].filter(Boolean);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "update_belief",
    {
      title: "Update Belief",
      description: "Updates a belief's name or description.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the belief to update"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
      },
    },
    async ({ id, name, description }) => {
      const { updateBelief } = await import("../store/beliefs.js");
      const updates: { name?: string; description?: string } = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      const belief = await updateBelief(id, updates);
      if (!belief) {
        return { content: [{ type: "text", text: `Belief with ID ${id} not found.` }], isError: true };
      }
      return { content: [{ type: "text", text: `Updated belief: ${belief.name}` }] };
    }
  );

  server.registerTool(
    "create_belief",
    {
      title: "Create Belief",
      description: "Creates a core belief — a foundational value that motivates ends.",
      inputSchema: {
        name: z.string().min(1).describe("The belief statement"),
        description: z.string().optional().describe("Additional context"),
      },
    },
    async ({ name, description }) => {
      const { createBelief } = await import("../store/beliefs.js");
      const belief = await createBelief({ name, description });
      return { content: [{ type: "text", text: `Created belief: ${belief.name} (${belief.id})` }] };
    }
  );

  server.registerTool(
    "delete_belief",
    {
      title: "Delete Belief",
      description: "Deletes a belief by ID. Removes all end linkages.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the belief to delete"),
      },
    },
    async ({ id }) => {
      const { deleteBelief } = await import("../store/beliefs.js");
      const belief = await deleteBelief(id);
      if (!belief) {
        return { content: [{ type: "text", text: `Belief with ID ${id} not found.` }], isError: true };
      }
      return { content: [{ type: "text", text: `Deleted belief: ${belief.name}` }] };
    }
  );

  server.registerTool(
    "link_end_to_belief",
    {
      title: "Link End to Belief",
      description: "Links an end to a belief, indicating the end is motivated by this belief.",
      inputSchema: {
        beliefId: z.string().min(1).describe("ID of the belief"),
        endId: z.string().min(1).describe("ID of the end"),
      },
    },
    async ({ beliefId, endId }) => {
      const { linkEndToBelief } = await import("../store/beliefs.js");
      await linkEndToBelief(beliefId, endId);
      return { content: [{ type: "text", text: `Linked end ${endId} to belief ${beliefId}` }] };
    }
  );

  server.registerTool(
    "unlink_end_from_belief",
    {
      title: "Unlink End from Belief",
      description: "Removes the link between an end and a belief.",
      inputSchema: {
        beliefId: z.string().min(1).describe("ID of the belief"),
        endId: z.string().min(1).describe("ID of the end"),
      },
    },
    async ({ beliefId, endId }) => {
      const { unlinkEndFromBelief } = await import("../store/beliefs.js");
      await unlinkEndFromBelief(beliefId, endId);
      return { content: [{ type: "text", text: `Unlinked end ${endId} from belief ${beliefId}` }] };
    }
  );

  // --- Areas ---

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
        "Lists ends and habits. Filter by areaId OR portfolioId (mutually exclusive). Omit both to show all areas.",
      inputSchema: {
        areaId: z.string().optional().describe("Filter to a specific area. Mutually exclusive with portfolioId."),
        portfolioId: z.string().optional().describe("Filter to a specific portfolio. Mutually exclusive with areaId."),
      },
    },
    async ({ areaId, portfolioId }) => {
      if (areaId && portfolioId) {
        return {
          content: [{ type: "text", text: "Provide areaId OR portfolioId, not both." }],
          isError: true,
        };
      }

      const areas = await listAreas();
      const allEnds = await listEnds();
      const allHabits = await listHabits();

      if (portfolioId) {
        const portfolio = await getPortfolioById(portfolioId);
        if (!portfolio) {
          return {
            content: [{ type: "text", text: `Portfolio with ID ${portfolioId} not found.` }],
            isError: true,
          };
        }
        const ends = allEnds.filter((e) => e.portfolioId === portfolioId);
        const parts: string[] = [`## ${portfolio.name}`];
        for (const e of ends) {
          const habitsForEnd = allHabits.filter((h) => h.endIds.includes(e.id));
          parts.push(`  - ${e.name} (${e.id})`);
          habitsForEnd.forEach((h) => parts.push(`    - ${h.name} (${h.id})`));
        }
        if (ends.length === 0) {
          return {
            content: [{ type: "text", text: `No ends or habits in portfolio "${portfolio.name}".` }],
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
    "update_organization",
    {
      title: "Update Organization",
      description: "Updates an organization's name.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the organization to update"),
        name: z.string().optional().describe("New name"),
      },
    },
    async ({ id, name }) => {
      const { updateOrganization } = await import("../store/organizations.js");
      const org = await updateOrganization(id, { name });
      if (!org) {
        return { content: [{ type: "text", text: `Organization with ID ${id} not found.` }], isError: true };
      }
      return { content: [{ type: "text", text: `Updated organization: ${org.name}` }] };
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
    "update_team",
    {
      title: "Update Team",
      description: "Updates a team's name.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the team to update"),
        name: z.string().optional().describe("New team name"),
      },
    },
    async ({ id, name }) => {
      const { updateTeam } = await import("../store/teams.js");
      const team = await updateTeam(id, { name });
      if (!team) {
        return { content: [{ type: "text", text: `Team with ID ${id} not found.` }], isError: true };
      }
      return { content: [{ type: "text", text: `Updated team: ${team.name}` }] };
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
    "create_portfolio",
    {
      title: "Create Portfolio",
      description:
        "Creates a portfolio - a grouping of ends under an org, team, or person. Enables the view: (org/team/person) -> portfolio -> ends -> habits.",
      inputSchema: {
        name: z.string().min(1).describe("Portfolio name"),
        ownerType: z
          .enum(["organization", "team", "person"])
          .describe("Type of owner (org, team, or person)"),
        ownerId: z.string().min(1).describe("ID of the organization, team, or person"),
        portfolioType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Type of portfolio (goals, projects, quarterly, backlog, other)"),
        description: z.string().optional().describe("Optional description"),
      },
    },
    async ({ name, ownerType, ownerId, portfolioType, description }) => {
      const portfolio = await createPortfolio({
        name,
        ownerType,
        ownerId,
        portfolioType,
        description,
      });
      return {
        content: [
          {
            type: "text",
            text: `Created portfolio: ${portfolio.name}\nID: ${portfolio.id}\nOwner: ${portfolio.ownerType} ${portfolio.ownerId}\n${portfolio.portfolioType ? `Type: ${portfolio.portfolioType}\n` : ""}${portfolio.description ? `Description: ${portfolio.description}\n` : ""}Created at: ${portfolio.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_portfolios",
    {
      title: "List Portfolios",
      description:
        "Lists portfolios. Filter by owner (ownerType + ownerId) or by portfolioType.",
      inputSchema: {
        ownerType: z
          .enum(["organization", "team", "person"])
          .optional()
          .describe("Filter by owner type"),
        ownerId: z.string().optional().describe("Filter by owner ID"),
        portfolioType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Filter by portfolio type"),
      },
    },
    async ({ ownerType, ownerId, portfolioType }) => {
      const portfolios = await listPortfolios(
        ownerType || ownerId || portfolioType
          ? { ownerType, ownerId, portfolioType }
          : undefined
      );
      if (portfolios.length === 0) {
        return { content: [{ type: "text", text: "No portfolios found." }] };
      }
      const lines = await Promise.all(portfolios.map(async (c) => {
        const ownerName = await resolveOwnerName(c.ownerType, c.ownerId);
        return `  ${c.name} (${c.id}) - ${c.ownerType}: ${ownerName}${c.portfolioType ? ` [${c.portfolioType}]` : ""}`;
      }));
      return {
        content: [
          {
            type: "text",
            text: `Found ${portfolios.length} portfolio(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "Get Portfolio",
      description:
        "Gets a single portfolio by ID with full details: owner, type, and the ends it contains.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the portfolio to fetch"),
      },
    },
    async ({ id }) => {
      const portfolio = await getPortfolioById(id);
      if (!portfolio) {
        return { content: [{ type: "text", text: `Portfolio with ID ${id} not found.` }], isError: true };
      }
      const ownerName = await resolveOwnerName(portfolio.ownerType, portfolio.ownerId);
      const allEnds = await listEnds();
      const ends = allEnds.filter((e) => e.portfolioId === id);
      const endLines = ends.map((e) => `    - ${e.name} (${e.id})`);
      const parts = [
        `${portfolio.name} (${portfolio.id})`,
        `  Owner: ${ownerName} (${portfolio.ownerType})`,
        portfolio.portfolioType && `  Type: ${portfolio.portfolioType}`,
        portfolio.description && `  Description: ${portfolio.description}`,
        `  Created: ${portfolio.createdAt}`,
        ends.length > 0 ? `  Ends:\n${endLines.join("\n")}` : "  Ends: (none)",
      ].filter(Boolean);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "update_portfolio",
    {
      title: "Update Portfolio",
      description: "Updates a portfolio by ID. Only provided fields are updated.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the portfolio to update"),
        name: z.string().min(1).optional().describe("Portfolio name"),
        portfolioType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Portfolio type"),
        description: z.string().optional().describe("Description"),
      },
    },
    async ({ id, name, portfolioType, description }) => {
      const existing = await getPortfolioById(id);
      if (!existing) {
        return {
          content: [{ type: "text", text: `Portfolio with ID ${id} not found.` }],
          isError: true,
        };
      }
      const updates: Record<string, unknown> = {};
      if (name != null) updates.name = name;
      if (portfolioType !== undefined) updates.portfolioType = portfolioType;
      if (description !== undefined) updates.description = description;
      const portfolio = await updatePortfolio(id, updates);
      return {
        content: [
          {
            type: "text",
            text: `Updated portfolio: ${portfolio?.name} (${id})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_portfolio",
    {
      title: "Delete Portfolio",
      description:
        "Deletes a portfolio by ID. Ends in the portfolio are not deleted; their portfolioId is not automatically cleared.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the portfolio to delete"),
      },
    },
    async ({ id }) => {
      const portfolio = await getPortfolioById(id);
      if (!portfolio) {
        return {
          content: [{ type: "text", text: `Portfolio with ID ${id} not found.` }],
          isError: true,
        };
      }
      await deletePortfolio(id);
      return {
        content: [
          {
            type: "text",
            text: `Deleted portfolio: ${portfolio.name} (${id})`,
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
        portfolioId: z.string().optional().describe("Portfolio this end belongs to"),
      },
    },
    async ({ name, areaId, portfolioId }) => {
      const end = await createEnd({ name, areaId, portfolioId });
      return {
        content: [
          {
            type: "text",
            text: `Created end: ${end.name}\nID: ${end.id}\n${end.areaId ? `Area: ${end.areaId}\n` : ""}${end.portfolioId ? `Portfolio: ${end.portfolioId}\n` : ""}Created at: ${end.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_ends",
    {
      title: "List Ends",
      description: "Lists ends. Optionally filter by area ID or portfolio ID.",
      inputSchema: {
        areaId: z.string().optional().describe("Filter by area ID"),
        portfolioId: z.string().optional().describe("Filter by portfolio ID"),
      },
    },
    async ({ areaId, portfolioId }) => {
      const ends = await listEnds(areaId || portfolioId ? { areaId, portfolioId } : undefined);
      if (ends.length === 0) {
        return { content: [{ type: "text", text: "No ends found." }] };
      }
      const allAreas = await listAreas();
      const allPortfolios = await listPortfolios();
      const lines = ends.map((e) => {
        const area = e.areaId ? allAreas.find((a) => a.id === e.areaId) : undefined;
        const portfolio = e.portfolioId ? allPortfolios.find((c) => c.id === e.portfolioId) : undefined;
        return `  ${e.name} (${e.id})${area ? ` - Area: ${area.name}` : ""}${portfolio ? ` - Portfolio: ${portfolio.name}` : ""}`;
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
        "Gets a single end by ID with full details: area, portfolio, habits (with participants), and sharing info.",
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
      const portfolios = await listPortfolios();
      const portfolio = end.portfolioId ? portfolios.find((c) => c.id === end.portfolioId) : undefined;
      const allHabits = await listHabitsWithShared({ endId: id });
      const myHabits = allHabits.filter((h) => !h.isShared);
      const sharedHabits = allHabits.filter((h) => h.isShared);

      async function formatHabitLine(h: typeof allHabits[0]): Promise<string> {
        const personNames: string[] = [];
        for (const pid of h.personIds ?? []) {
          const person = await getPersonById(pid);
          personNames.push(person ? `${person.firstName} ${person.lastName}` : pid);
        }
        const meta: string[] = [];
        if (h.frequency) meta.push(h.frequency);
        if (personNames.length) meta.push(`participants: ${personNames.join(", ")}`);
        if (h.isShared && h.ownerId) {
          const { data: ownerPerson } = await getSupabase()
            .from("persons")
            .select("first_name, last_name")
            .eq("linked_user_id", h.ownerId)
            .eq("relationship_type", "self")
            .single();
          const ownerName = ownerPerson ? `${ownerPerson.first_name} ${ownerPerson.last_name}` : h.ownerDisplayName ?? "unknown";
          // Only show "by" if owner isn't already in the participants list
          if (!personNames.includes(ownerName)) {
            meta.push(`by ${ownerName}`);
          }
        }
        return `    - ${h.name} (${h.id})${meta.length ? ` [${meta.join(", ")}]` : ""}`;
      }

      const myHabitLines = await Promise.all(myHabits.map(formatHabitLine));
      const sharedHabitLines = await Promise.all(sharedHabits.map(formatHabitLine));
      const { listBeliefs } = await import("../store/beliefs.js");
      const allBeliefs = await listBeliefs();
      const linkedBeliefs = allBeliefs.filter((b) => b.endIds.includes(id));
      const beliefLines = linkedBeliefs.map((b) => `    - ${b.name}`);

      // Contextual sharing info
      const shares = await listMyShares();
      const endShares = shares.filter((s) => s.endId === id);
      const isOwner = endShares.length > 0;
      let sharingLine: string | undefined;

      if (isOwner) {
        const sharedWithLines = await Promise.all(endShares.map(async (s) => {
          const { data: person } = await getSupabase()
            .from("persons")
            .select("first_name, last_name")
            .eq("linked_user_id", s.sharedWithUserId)
            .eq("relationship_type", "self")
            .single();
          return person ? `    - ${person.first_name} ${person.last_name}` : `    - ${s.sharedWithEmail}`;
        }));
        if (sharedWithLines.length > 0) {
          sharingLine = `  Shared with:\n${sharedWithLines.join("\n")}`;
        }
      } else {
        const sharedEnds = await listSharedEnds();
        const sharedEnd = sharedEnds.find((e) => e.id === id);
        if (sharedEnd?.ownerDisplayName) {
          sharingLine = `  Shared by: ${sharedEnd.ownerDisplayName}`;
        }
      }
      const { listTasksForEnd } = await import("../store/tasks.js");
      const tasks = await listTasksForEnd(id, { completed: false });
      const isSharedEnd = sharingLine !== undefined;
      const taskLines = tasks.map((t) => {
        const meta: string[] = [];
        if (t.dueDate) meta.push(`due: ${t.dueDate}`);
        if (isSharedEnd && t.ownerDisplayName) meta.push(`by ${t.ownerDisplayName}`);
        return `    - ${t.name} (${t.id})${meta.length ? ` [${meta.join(", ")}]` : ""}`;
      });
      const parts = [
        `${end.name} (${end.id})`,
        area && `  Area: ${area.name}`,
        portfolio && `  Portfolio: ${portfolio.name}`,
        `  Created: ${end.createdAt}`,
        linkedBeliefs.length > 0 ? `  Beliefs:\n${beliefLines.join("\n")}` : undefined,
        myHabitLines.length > 0 ? `  Your habits:\n${myHabitLines.join("\n")}` : "  Your habits: (none)",
        sharedHabitLines.length > 0 ? `  Shared habits:\n${sharedHabitLines.join("\n")}` : undefined,
        taskLines.length > 0 ? `  Open tasks:\n${taskLines.join("\n")}` : undefined,
        sharingLine,
      ].filter(Boolean);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "update_end",
    {
      title: "Update End",
      description:
        "Updates an end by ID. Only provided fields are updated. Use to add an end to a portfolio, change its area, or rename it.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the end to update"),
        name: z.string().min(1).optional().describe("End name"),
        areaId: z.string().optional().describe("Area this end belongs to"),
        portfolioId: z.string().optional().describe("Portfolio this end belongs to"),
      },
    },
    async ({ id, name, areaId, portfolioId }) => {
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
      if (portfolioId !== undefined) updates.portfolioId = portfolioId;
      const end = await updateEnd(id, updates);
      return {
        content: [
          {
            type: "text",
            text: `Updated end: ${end?.name} (${id})${end?.portfolioId ? ` - Portfolio: ${end.portfolioId}` : ""}`,
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
      let habits = await listHabits({
        endId,
        areaId,
        teamId,
        personId,
      });

      // Also include habits linked to ends in this area
      if (areaId && !endId) {
        const allEnds = await listEnds();
        const endIdsInArea = new Set(allEnds.filter((e) => e.areaId === areaId).map((e) => e.id));
        const allHabits = await listHabits({ personId });
        const habitIds = new Set(habits.map((h) => h.id));
        for (const h of allHabits) {
          if (!habitIds.has(h.id) && h.endIds.some((eid) => endIdsInArea.has(eid))) {
            habits.push(h);
            habitIds.add(h.id);
          }
        }
      }

      if (habits.length === 0) {
        return { content: [{ type: "text", text: "No habits found." }] };
      }
      const allEnds = await listEnds({ includeShared: true });
      const allAreas = await listAreas();
      const lines = await Promise.all(habits.map(async (h) => {
        const endNames = h.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid).join(", ");
        const meta: string[] = [];
        if (h.frequency) meta.push(h.frequency);
        if (h.durationMinutes != null) meta.push(`${h.durationMinutes} min`);
        if (h.areaId) {
          const area = allAreas.find((a) => a.id === h.areaId);
          meta.push(`area: ${area?.name ?? h.areaId}`);
        }
        if (h.teamId) {
          const team = await getTeamById(h.teamId);
          meta.push(`team: ${team?.name ?? h.teamId}`);
        }
        return `  ${h.name} (${h.id})\n    Ends: ${endNames}${meta.length ? ` | ${meta.join(", ")}` : ""}`;
      }));
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
      const { listActionsWithShared } = await import("../store/actions.js");
      const actions = await listActionsWithShared({ habitId: id });
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
          const byLine = a.isShared && a.ownerDisplayName ? ` — by ${a.ownerDisplayName}` : "";
          parts.push(`    - ${a.completedAt.slice(0, 10)}${extra}${byLine}`);
        }
      } else {
        parts.push("  Recent actions: (none)");
      }

      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
  );

  server.registerTool(
    "update_habit",
    {
      title: "Update Habit",
      description:
        "Updates a habit's name, frequency, or duration. Supports adding/removing participants and linking/unlinking/moving ends.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the habit to update"),
        name: z.string().optional().describe("New name"),
        frequency: z.string().optional().describe("New frequency (daily, weekly, monthly, etc.)"),
        durationMinutes: z.number().optional().describe("New expected duration in minutes"),
        personIdsToAdd: z.array(z.string()).optional().describe("Person IDs to add as participants"),
        personIdsToRemove: z.array(z.string()).optional().describe("Person IDs to remove as participants"),
        endIdToAdd: z.string().optional().describe("End ID to link (additive)"),
        endIdToRemove: z.string().optional().describe("End ID to unlink"),
        endIdsToReplace: z.array(z.string()).optional().describe("Replace all end links with this list"),
      },
    },
    async ({ id, name, frequency, durationMinutes, personIdsToAdd, personIdsToRemove, endIdToAdd, endIdToRemove, endIdsToReplace }) => {
      const existing = await getHabitById(id);
      if (!existing) {
        return {
          content: [{ type: "text", text: `Habit with ID ${id} not found.` }],
          isError: true,
        };
      }
      const details: string[] = [];
      const fieldUpdates: { name?: string; frequency?: string; durationMinutes?: number } = {};
      if (name != null) fieldUpdates.name = name;
      if (frequency != null) fieldUpdates.frequency = frequency;
      if (durationMinutes != null) fieldUpdates.durationMinutes = durationMinutes;
      if (Object.keys(fieldUpdates).length > 0) {
        await updateHabit(id, fieldUpdates);
        if (name) details.push(`renamed to "${name}"`);
        if (frequency) details.push(`frequency: ${frequency}`);
        if (durationMinutes != null) details.push(`duration: ${durationMinutes} min`);
      }
      if (personIdsToAdd?.length) {
        await addHabitPersons(id, personIdsToAdd);
        details.push(`added ${personIdsToAdd.length} participant(s)`);
      }
      if (personIdsToRemove?.length) {
        await removeHabitPersons(id, personIdsToRemove);
        details.push(`removed ${personIdsToRemove.length} participant(s)`);
      }
      if (endIdsToReplace) {
        await updateHabitEnds(id, endIdsToReplace);
        details.push(`replaced end links`);
      } else {
        if (endIdToAdd) {
          const current = await getHabitById(id);
          const currentIds = current?.endIds ?? [];
          if (!currentIds.includes(endIdToAdd)) {
            await updateHabitEnds(id, [...currentIds, endIdToAdd]);
            details.push(`linked end ${endIdToAdd}`);
          }
        }
        if (endIdToRemove) {
          const current = await getHabitById(id);
          const currentIds = current?.endIds ?? [];
          await updateHabitEnds(id, currentIds.filter((eid) => eid !== endIdToRemove));
          details.push(`unlinked end ${endIdToRemove}`);
        }
      }
      const habit = await getHabitById(id);
      return {
        content: [
          {
            type: "text",
            text: `Updated habit: ${habit?.name ?? id}${details.length ? ` — ${details.join(", ")}` : ""}`,
          },
        ],
      };
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
      const allAreas = await listAreas();
      const allEnds = await listEnds();
      const lines = await Promise.all(tasks.map(async (t) => {
        const status = t.completedAt ? `✓ ${t.completedAt.slice(0, 10)}` : "open";
        const end = t.endId ? allEnds.find((e) => e.id === t.endId) : undefined;
        const area = t.areaId ? allAreas.find((a) => a.id === t.areaId) : undefined;
        const withNames = t.withPersonIds?.length
          ? await Promise.all(t.withPersonIds.map(async (pid) => {
              const p = await getPersonById(pid);
              return p ? `${p.firstName} ${p.lastName}` : pid;
            }))
          : undefined;
        const forNames = t.forPersonIds?.length
          ? await Promise.all(t.forPersonIds.map(async (pid) => {
              const p = await getPersonById(pid);
              return p ? `${p.firstName} ${p.lastName}` : pid;
            }))
          : undefined;
        const parts = [
          `  ${t.name} (${t.id}) [${status}]`,
          end ? `end: ${end.name}` : null,
          area ? `area: ${area.name}` : null,
          t.dueDate ? `due: ${t.dueDate}` : null,
          t.actualDurationMinutes != null ? `${t.actualDurationMinutes} min` : null,
          withNames?.length ? `with: ${withNames.join(", ")}` : null,
          forNames?.length ? `for: ${forNames.join(", ")}` : null,
        ].filter(Boolean);
        return parts.join(" | ");
      }));
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

  // --- Task Time ---

  server.registerTool(
    "log_task_time",
    {
      title: "Log Task Time",
      description: "Records a work session against a task. Different from completing the task — this tracks time spent.",
      inputSchema: {
        taskId: z.string().min(1).describe("ID of the task"),
        completedAt: z.string().describe("When the work happened (YYYY-MM-DD or ISO timestamp)"),
        actualDurationMinutes: z.number().optional().describe("Duration in minutes"),
        notes: z.string().optional().describe("Notes about what was done"),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs worked with"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs worked for"),
      },
    },
    async ({ taskId, completedAt, actualDurationMinutes, notes, withPersonIds, forPersonIds }) => {
      const { createTaskTime } = await import("../store/taskTime.js");
      const completedAtISO = completedAt.length === 10 ? `${completedAt}T12:00:00.000Z` : completedAt;
      const entry = await createTaskTime({ taskId, completedAt: completedAtISO, actualDurationMinutes, notes, withPersonIds, forPersonIds });
      return { content: [{ type: "text", text: `Logged task time: ${entry.id}${actualDurationMinutes ? ` (${actualDurationMinutes} min)` : ""}` }] };
    }
  );

  server.registerTool(
    "list_task_time",
    {
      title: "List Task Time",
      description: "Lists task time entries. Filter by task, or by date range.",
      inputSchema: {
        taskId: z.string().optional().describe("Filter by task ID"),
        fromDate: z.string().optional().describe("YYYY-MM-DD start date"),
        toDate: z.string().optional().describe("YYYY-MM-DD end date"),
      },
    },
    async ({ taskId, fromDate, toDate }) => {
      const { listTaskTime } = await import("../store/taskTime.js");
      const entries = await listTaskTime({ taskId, fromDate, toDate });
      if (entries.length === 0) {
        return { content: [{ type: "text", text: "No task time entries found." }] };
      }
      const lines = entries.map((e) => {
        const date = e.completedAt.slice(0, 10);
        const parts: string[] = [];
        if (e.actualDurationMinutes != null) parts.push(`${e.actualDurationMinutes} min`);
        if (e.notes) parts.push(e.notes);
        return `  ${date}: task ${e.taskId}${parts.length ? ` (${parts.join(", ")})` : ""} [${e.id}]`;
      });
      return { content: [{ type: "text", text: `Task time entries:\n\n${lines.join("\n")}` }] };
    }
  );

  server.registerTool(
    "delete_task_time",
    {
      title: "Delete Task Time",
      description: "Deletes a task time entry by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task time entry"),
      },
    },
    async ({ id }) => {
      const { deleteTaskTime } = await import("../store/taskTime.js");
      const entry = await deleteTaskTime(id);
      if (!entry) {
        return { content: [{ type: "text", text: `Task time entry ${id} not found.` }], isError: true };
      }
      return { content: [{ type: "text", text: `Deleted task time entry ${id}` }] };
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
          .enum(["self", "spouse", "child", "parent", "sibling", "in-law", "friend", "colleague", "mentor", "client", "other"])
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
          .enum(["self", "spouse", "child", "parent", "sibling", "in-law", "friend", "colleague", "mentor", "client", "other"])
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
          .enum(["self", "spouse", "child", "parent", "sibling", "in-law", "friend", "colleague", "mentor", "client", "other"])
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
    "link_person",
    {
      title: "Link Person to User Account",
      description: "Links a person record to a user account by looking up the email in profiles. Optionally updates the person's email first.",
      inputSchema: {
        personId: z.string().min(1).describe("ID of the person to link"),
        emailOverride: z.string().optional().describe("If provided, updates the person's email before looking up"),
      },
    },
    async ({ personId, emailOverride }) => {
      const person = await getPersonById(personId);
      if (!person) {
        return { content: [{ type: "text", text: `Person not found.` }], isError: true };
      }
      if (person.userId) {
        return { content: [{ type: "text", text: `${person.firstName} ${person.lastName} is already linked to an account.` }] };
      }
      const lookupEmail = emailOverride ?? person.email;
      if (!lookupEmail || lookupEmail === "unknown@example.com") {
        return { content: [{ type: "text", text: `${person.firstName} ${person.lastName} has no email on file.` }], isError: true };
      }
      if (emailOverride && emailOverride !== person.email) {
        await updatePerson(personId, { email: emailOverride });
      }
      const { getSupabase } = await import("../store/base.js");
      const supabase = getSupabase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", lookupEmail)
        .single();
      if (!profile) {
        return { content: [{ type: "text", text: `No user account found for ${lookupEmail}.` }], isError: true };
      }
      await updatePerson(personId, { userId: profile.id });
      return { content: [{ type: "text", text: `Linked ${person.firstName} ${person.lastName} to ${lookupEmail}.` }] };
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
