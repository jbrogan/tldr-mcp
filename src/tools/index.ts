/**
 * MCP Tools - Functions callable by the LLM
 *
 * Add your tool implementations here. Each tool receives validated
 * arguments and returns content for the client.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createPerson,
  deletePerson,
  getPersonById,
  listPersons,
  removeGroupFromAllPersons,
  updatePerson,
} from "../store/persons.js";
import { listDomains, getDomainById } from "../store/domains.js";
import {
  createOrganization,
  deleteOrganization,
  getOrganizationById,
  listOrganizations,
} from "../store/organizations.js";
import {
  createGroup,
  deleteGroup,
  getGroupById,
  listGroups,
  deleteGroupsByOrganizationId,
} from "../store/groups.js";
import {
  createEnd,
  deleteEnd,
  getEndById,
  listEnds,
} from "../store/ends.js";
import {
  createHabit,
  deleteHabit,
  getHabitById,
  listHabits,
} from "../store/habits.js";
import {
  createAction,
  deleteAction,
  deleteActionsByHabitId,
  listActions,
} from "../store/actions.js";
import { interpretAndExecute } from "../services/naturalLanguage.js";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "list_domains",
    {
      title: "List Domains",
      description:
        "Lists all Wheel of Life domains (Career, Family, Health, etc.). Domains are seeded on first use.",
      inputSchema: {},
    },
    async () => {
      const domains = await listDomains();
      const lines = domains.map(
        (d) => `  ${d.name} (${d.id})`
      );
      return {
        content: [
          {
            type: "text",
            text: `Domains:\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_ends_and_habits_by_domain",
    {
      title: "List Ends and Habits by Domain",
      description:
        "Lists ends and habits grouped by domain. If domainId is specified, shows only that domain. Otherwise shows all domains.",
      inputSchema: {
        domainId: z.string().optional().describe("Filter to a specific domain. Omit to show all domains."),
      },
    },
    async ({ domainId }) => {
      const domains = await listDomains();
      const allEnds = await listEnds();
      const allHabits = await listHabits();

      const domainIdsToShow = domainId
        ? (await getDomainById(domainId) ? [domainId] : [])
        : domains.map((d) => d.id);

      if (domainId && domainIdsToShow.length === 0) {
        return {
          content: [{ type: "text", text: `Domain with ID ${domainId} not found.` }],
          isError: true,
        };
      }

      const sections: string[] = [];

      for (const dId of domainIdsToShow) {
        const domain = domains.find((d) => d.id === dId);
        const domainName = domain?.name ?? dId;
        const ends = allEnds.filter((e) => e.domainId === dId);
        const habits = allHabits.filter((h) => h.domainId === dId);

        if (ends.length === 0 && habits.length === 0) continue;

        const parts: string[] = [`## ${domainName}`];
        if (ends.length > 0) {
          parts.push("Ends:");
          ends.forEach((e) => parts.push(`  - ${e.name} (${e.id})`));
        }
        if (habits.length > 0) {
          parts.push("Habits:");
          habits.forEach((h) => {
            const endNames = h.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid).join(", ");
            parts.push(`  - ${h.name} (${h.id}) → serves: ${endNames}`);
          });
        }
        sections.push(parts.join("\n"));
      }

      // Uncategorized: ends/habits without domainId
      const uncategorizedEnds = allEnds.filter((e) => !e.domainId);
      const uncategorizedHabits = allHabits.filter((h) => !h.domainId);
      if (uncategorizedEnds.length > 0 || uncategorizedHabits.length > 0) {
        const parts: string[] = ["## Uncategorized"];
        if (uncategorizedEnds.length > 0) {
          parts.push("Ends:");
          uncategorizedEnds.forEach((e) => parts.push(`  - ${e.name} (${e.id})`));
        }
        if (uncategorizedHabits.length > 0) {
          parts.push("Habits:");
          uncategorizedHabits.forEach((h) => {
            const endNames = h.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid).join(", ");
            parts.push(`  - ${h.name} (${h.id}) → serves: ${endNames}`);
          });
        }
        sections.push(parts.join("\n"));
      }

      if (sections.length === 0) {
        return {
          content: [{ type: "text", text: domainId ? "No ends or habits found for this domain." : "No ends or habits found." }],
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
        "Creates a new organization - a container for groups and people (e.g., company, church, family).",
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
        "Lists all organizations. Use expand to show groups and people under each org.",
      inputSchema: {
        expand: z.boolean().optional().describe("If true, show groups and people under each organization"),
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
        const groups = await listGroups(org.id);
        const parts: string[] = [`  ${org.name} (${org.id})`, "    Groups:"];
        if (groups.length === 0) {
          parts.push("      (no groups)");
        } else {
          for (const g of groups) {
            const people = await listPersons({ groupId: g.id });
            const peopleNames = people.map((p) => `${p.firstName} ${p.lastName}`).join(", ");
            parts.push(`      - ${g.name} (${g.id})`);
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
      const groups = await listGroups(id);
      for (const g of groups) {
        await removeGroupFromAllPersons(g.id);
      }
      await deleteGroupsByOrganizationId(id);
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
    "create_group",
    {
      title: "Create Group",
      description:
        "Creates a new group within an organization. Groups are sub-teams (e.g., Engineering, Leadership, Kids) that people can belong to.",
      inputSchema: {
        name: z.string().min(1).describe("Group name"),
        organizationId: z.string().min(1).describe("ID of the organization this group belongs to"),
      },
    },
    async ({ name, organizationId }) => {
      const group = await createGroup({ name, organizationId });
      return {
        content: [
          {
            type: "text",
            text: `Created group: ${group.name}\nID: ${group.id}\nOrganization ID: ${group.organizationId}\nCreated at: ${group.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_groups",
    {
      title: "List Groups",
      description:
        "Lists groups. Optionally filter by organization ID.",
      inputSchema: {
        organizationId: z.string().optional().describe("Filter by organization ID"),
      },
    },
    async ({ organizationId }) => {
      const groups = await listGroups(organizationId);
      if (groups.length === 0) {
        return { content: [{ type: "text", text: "No groups found." }] };
      }
      const lines = groups.map((g) => `  ${g.name} (${g.id}) - Organization: ${g.organizationId}`);
      return {
        content: [
          {
            type: "text",
            text: `Found ${groups.length} group(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_group",
    {
      title: "Delete Group",
      description:
        "Deletes a group by ID. Removes the group from all persons' memberships.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the group to delete"),
      },
    },
    async ({ id }) => {
      const group = await getGroupById(id);
      if (!group) {
        return {
          content: [{ type: "text", text: `Group with ID ${id} not found.` }],
          isError: true,
        };
      }
      await removeGroupFromAllPersons(id);
      await deleteGroup(id);
      return {
        content: [
          {
            type: "text",
            text: `Deleted group: ${group.name} (${group.id})`,
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
        domainId: z.string().optional().describe("Domain this end belongs to"),
      },
    },
    async ({ name, domainId }) => {
      const end = await createEnd({ name, domainId });
      return {
        content: [
          {
            type: "text",
            text: `Created end: ${end.name}\nID: ${end.id}\n${end.domainId ? `Domain: ${end.domainId}\n` : ""}Created at: ${end.createdAt}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_ends",
    {
      title: "List Ends",
      description: "Lists ends. Optionally filter by domain ID.",
      inputSchema: {
        domainId: z.string().optional().describe("Filter by domain ID"),
      },
    },
    async ({ domainId }) => {
      const ends = await listEnds(domainId);
      if (ends.length === 0) {
        return { content: [{ type: "text", text: "No ends found." }] };
      }
      const lines = ends.map(
        (e) => `  ${e.name} (${e.id})${e.domainId ? ` - Domain: ${e.domainId}` : ""}`
      );
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
        domainId: z.string().optional(),
        groupId: z.string().optional(),
        personId: z.string().optional().describe("ID of the person expected to perform the habit (the doer), not the focus/recipient"),
        frequency: z.string().optional().describe("e.g. daily, weekly, 3x/week"),
        durationMinutes: z.number().int().positive().optional().describe("Estimated time in minutes"),
      },
    },
    async ({ name, endIds, domainId, groupId, personId, frequency, durationMinutes }) => {
      const habit = await createHabit({
        name,
        endIds,
        domainId,
        groupId,
        personId,
        frequency,
        durationMinutes,
      });
      const parts = [
        `Created habit: ${habit.name}`,
        `ID: ${habit.id}`,
        `Ends: ${habit.endIds.join(", ")}`,
        habit.domainId && `Domain: ${habit.domainId}`,
        habit.groupId && `Group: ${habit.groupId}`,
        habit.personId && `Performed by: ${habit.personId}`,
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
        "Lists habits. Optionally filter by end, domain, organization, or person.",
      inputSchema: {
        endId: z.string().optional().describe("Filter by end ID"),
        domainId: z.string().optional().describe("Filter by domain ID"),
        groupId: z.string().optional().describe("Filter by group ID"),
        personId: z.string().optional().describe("Filter by person who performs the habit"),
      },
    },
    async ({ endId, domainId, groupId, personId }) => {
      const habits = await listHabits({
        endId,
        domainId,
        groupId,
        personId,
      });
      if (habits.length === 0) {
        return { content: [{ type: "text", text: "No habits found." }] };
      }
      const lines = habits.map((h) => {
        const meta: string[] = [];
        if (h.frequency) meta.push(h.frequency);
        if (h.durationMinutes != null) meta.push(`${h.durationMinutes} min`);
        if (h.domainId) meta.push(`domain: ${h.domainId}`);
        if (h.groupId) meta.push(`group: ${h.groupId}`);
        if (h.personId) meta.push(`person: ${h.personId}`);
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
        "Records a completed habit action (e.g., practiced guitar on Feb 24).",
      inputSchema: {
        habitId: z.string().min(1).describe("ID of the habit"),
        completedAt: z.string().describe("ISO date when completed (e.g. 2026-02-24)"),
        actualDurationMinutes: z.number().int().positive().optional().describe("Actual time spent in minutes"),
        notes: z.string().optional(),
      },
    },
    async ({ habitId, completedAt, actualDurationMinutes, notes }) => {
      const action = await createAction({ habitId, completedAt, actualDurationMinutes, notes });
      const habit = await getHabitById(habitId);
      return {
        content: [
          {
            type: "text",
            text: `Recorded action: ${habit?.name ?? habitId} on ${completedAt.slice(0, 10)}\nID: ${action.id}\n${actualDurationMinutes != null ? `Actual duration: ${actualDurationMinutes} min\n` : ""}${notes ? `Notes: ${notes}\n` : ""}Created at: ${action.createdAt}`,
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
        "Lists tracked actions. Optionally filter by habit or date range.",
      inputSchema: {
        habitId: z.string().optional().describe("Filter by habit ID"),
        fromDate: z.string().optional().describe("From date (YYYY-MM-DD)"),
        toDate: z.string().optional().describe("To date (YYYY-MM-DD)"),
      },
    },
    async ({ habitId, fromDate, toDate }) => {
      const actions = await listActions({ habitId, fromDate, toDate });
      if (actions.length === 0) {
        return { content: [{ type: "text", text: "No actions found." }] };
      }
      const lines = await Promise.all(
        actions.map(async (a) => {
          const habit = await getHabitById(a.habitId);
          return `  ${habit?.name ?? a.habitId} - ${a.completedAt.slice(0, 10)} (${a.id})${a.actualDurationMinutes != null ? ` - ${a.actualDurationMinutes} min` : ""}${a.notes ? ` - ${a.notes}` : ""}`;
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
        groupIds: z
          .array(z.string())
          .optional()
          .describe("IDs of groups this person belongs to"),
        relationshipType: z
          .enum(["spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Type of relationship (e.g. spouse, child, friend, colleague)"),
      },
    },
    async ({ firstName, lastName, email, phone, title, notes, groupIds, relationshipType }) => {
      const person = await createPerson({
        firstName,
        lastName,
        email,
        phone,
        title,
        notes,
        groupIds: groupIds ?? [],
        relationshipType,
      });

      const summary = [
        `Created person: ${person.firstName} ${person.lastName}`,
        `ID: ${person.id}`,
        `Email: ${person.email}`,
        person.phone && `Phone: ${person.phone}`,
        person.title && `Title: ${person.title}`,
        person.notes && `Notes: ${person.notes}`,
        person.relationshipType && `Relationship: ${person.relationshipType}`,
        person.groupIds?.length && `Groups: ${person.groupIds.join(", ")}`,
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
        "Gets a single person by ID with full details (groups, relationship, etc.). Use to verify a person exists or fetch their details before update_person.",
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
      const groupNames: string[] = [];
      for (const gId of person.groupIds ?? []) {
        const grp = await getGroupById(gId);
        groupNames.push(grp?.name ?? gId);
      }
      const parts = [
        `${person.firstName} ${person.lastName} (${person.id})`,
        `  Email: ${person.email}`,
        person.phone && `  Phone: ${person.phone}`,
        person.title && `  Title: ${person.title}`,
        person.relationshipType && `  Relationship: ${person.relationshipType}`,
        groupNames.length > 0 && `  Groups: ${groupNames.join(", ")}`,
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
        "Lists people. Optionally filter by organization ID, group ID, or relationship type.",
      inputSchema: {
        organizationId: z.string().optional().describe("Filter by organization ID"),
        groupId: z.string().optional().describe("Filter by group ID"),
        relationshipType: z
          .enum(["spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Filter by relationship type"),
      },
    },
    async ({ organizationId, groupId, relationshipType }) => {
      const people = await listPersons({ organizationId, groupId, relationshipType });

      if (people.length === 0) {
        return {
          content: [{ type: "text", text: "No people found." }],
        };
      }

      const lines = await Promise.all(
        people.map(async (p) => {
          const groupNames: string[] = [];
          for (const gId of p.groupIds ?? []) {
            const grp = await getGroupById(gId);
            groupNames.push(grp?.name ?? gId);
          }
          const parts = [
            `${p.firstName} ${p.lastName} (${p.id})`,
            `  Email: ${p.email}`,
            p.phone && `  Phone: ${p.phone}`,
            p.title && `  Title: ${p.title}`,
            p.relationshipType && `  Relationship: ${p.relationshipType}`,
            groupNames.length > 0 && `  Groups: ${groupNames.join(", ")}`,
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
    "update_person",
    {
      title: "Update Person",
      description:
        "Updates an existing person by ID. Use get_person or list_people to find the person. To add a person to new groups, use groupIdsToAdd (merges with existing). Use groupIds only to replace the entire list.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to update"),
        firstName: z.string().min(1).optional().describe("First name"),
        lastName: z.string().min(1).optional().describe("Last name"),
        email: z.string().email().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        title: z.string().optional().describe("Job title or role"),
        notes: z.string().optional().describe("Additional notes"),
        groupIds: z.array(z.string()).optional().describe("Group IDs (replaces entire list)"),
        groupIdsToAdd: z.array(z.string()).optional().describe("Group IDs to add (merges with existing; use when adding person to new groups)"),
        relationshipType: z
          .enum(["spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Relationship type"),
      },
    },
    async ({ id, firstName, lastName, email, phone, title, notes, groupIds, groupIdsToAdd, relationshipType }) => {
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
      if (groupIds !== undefined) updates.groupIds = groupIds;
      if (groupIdsToAdd !== undefined) updates.groupIdsToAdd = groupIdsToAdd;
      if (relationshipType !== undefined) updates.relationshipType = relationshipType;
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
        person.groupIds?.length && `Groups: ${person.groupIds.join(", ")}`,
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
        "Interpret natural language and execute the appropriate action. Examples: 'I went to the gym today for 60 minutes', 'I want to be a better father', 'What habits would help me be a better father?', 'Create an Engineering group in Newco', 'Add my wife Jennifer, jennifer@example.com'.",
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
}
