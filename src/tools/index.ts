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
  removeOrganizationFromAllPersons,
  removeGroupFromAllPersons,
  updatePerson,
} from "../store/persons.js";
import { listDomains } from "../store/domains.js";
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
    "create_organization",
    {
      title: "Create Organization",
      description:
        "Creates a new organization within a domain. Organizations are groups (e.g., company, church, family) that people can be members of.",
      inputSchema: {
        name: z.string().min(1).describe("Organization name"),
        domainId: z.string().min(1).describe("ID of the domain this organization belongs to"),
      },
    },
    async ({ name, domainId }) => {
      const org = await createOrganization({ name, domainId });
      return {
        content: [
          {
            type: "text",
            text: `Created organization: ${org.name}\nID: ${org.id}\nDomain ID: ${org.domainId}\nCreated at: ${org.createdAt}`,
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
        "Lists organizations. Optionally filter by domain ID.",
      inputSchema: {
        domainId: z.string().optional().describe("Filter by domain ID"),
      },
    },
    async ({ domainId }) => {
      const orgs = await listOrganizations(domainId);
      if (orgs.length === 0) {
        return {
          content: [{ type: "text", text: "No organizations found." }],
        };
      }
      const lines = orgs.map((o) => `  ${o.name} (${o.id}) - Domain: ${o.domainId}`);
      return {
        content: [
          {
            type: "text",
            text: `Found ${orgs.length} organization(s):\n\n${lines.join("\n")}`,
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
      await removeOrganizationFromAllPersons(id);
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
        organizationId: z.string().optional(),
        personId: z.string().optional(),
        frequency: z.string().optional().describe("e.g. daily, weekly, 3x/week"),
        durationMinutes: z.number().int().positive().optional().describe("Estimated time in minutes"),
      },
    },
    async ({ name, endIds, domainId, organizationId, personId, frequency, durationMinutes }) => {
      const habit = await createHabit({
        name,
        endIds,
        domainId,
        organizationId,
        personId,
        frequency,
        durationMinutes,
      });
      const parts = [
        `Created habit: ${habit.name}`,
        `ID: ${habit.id}`,
        `Ends: ${habit.endIds.join(", ")}`,
        habit.domainId && `Domain: ${habit.domainId}`,
        habit.organizationId && `Organization: ${habit.organizationId}`,
        habit.personId && `Person: ${habit.personId}`,
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
        organizationId: z.string().optional().describe("Filter by organization ID"),
        personId: z.string().optional().describe("Filter by person ID"),
      },
    },
    async ({ endId, domainId, organizationId, personId }) => {
      const habits = await listHabits({
        endId,
        domainId,
        organizationId,
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
        if (h.organizationId) meta.push(`org: ${h.organizationId}`);
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
        "Creates a new person entity with the provided details. Returns the created person including a generated ID. Optionally add organization memberships and relationship type.",
      inputSchema: {
        firstName: z.string().min(1).describe("First name of the person"),
        lastName: z.string().min(1).describe("Last name of the person"),
        email: z.string().email().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        title: z.string().optional().describe("Job title or role"),
        notes: z.string().optional().describe("Additional notes about the person"),
        organizationIds: z
          .array(z.string())
          .optional()
          .describe("IDs of organizations this person belongs to"),
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
    async ({ firstName, lastName, email, phone, title, notes, organizationIds, groupIds, relationshipType }) => {
      const person = await createPerson({
        firstName,
        lastName,
        email,
        phone,
        title,
        notes,
        organizationIds: organizationIds ?? [],
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
        person.organizationIds?.length &&
          `Organizations: ${person.organizationIds.join(", ")}`,
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
    "list_people",
    {
      title: "List People",
      description:
        "Lists people. Optionally filter by domain ID, organization ID, group ID, or relationship type.",
      inputSchema: {
        domainId: z.string().optional().describe("Filter by domain ID"),
        organizationId: z.string().optional().describe("Filter by organization ID"),
        groupId: z.string().optional().describe("Filter by group ID"),
        relationshipType: z
          .enum(["spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Filter by relationship type"),
      },
    },
    async ({ domainId, organizationId, groupId, relationshipType }) => {
      const people = await listPersons({ domainId, organizationId, groupId, relationshipType });

      if (people.length === 0) {
        return {
          content: [{ type: "text", text: "No people found." }],
        };
      }

      const lines = await Promise.all(
        people.map(async (p) => {
          const orgNames: string[] = [];
          for (const orgId of p.organizationIds ?? []) {
            const org = await getOrganizationById(orgId);
            orgNames.push(org?.name ?? orgId);
          }
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
            orgNames.length > 0 && `  Organizations: ${orgNames.join(", ")}`,
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
        "Updates an existing person by ID. Only provided fields are updated. Use to add/remove organizations, groups, or change other details.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to update"),
        firstName: z.string().min(1).optional().describe("First name"),
        lastName: z.string().min(1).optional().describe("Last name"),
        email: z.string().email().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        title: z.string().optional().describe("Job title or role"),
        notes: z.string().optional().describe("Additional notes"),
        organizationIds: z.array(z.string()).optional().describe("Organization IDs (replaces existing)"),
        groupIds: z.array(z.string()).optional().describe("Group IDs (replaces existing)"),
        relationshipType: z
          .enum(["spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Relationship type"),
      },
    },
    async ({ id, firstName, lastName, email, phone, title, notes, organizationIds, groupIds, relationshipType }) => {
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
      if (organizationIds !== undefined) updates.organizationIds = organizationIds;
      if (groupIds !== undefined) updates.groupIds = groupIds;
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
        person.organizationIds?.length && `Organizations: ${person.organizationIds.join(", ")}`,
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
        "Interpret natural language and execute the appropriate action. Examples: 'I went to the gym today for 60 minutes', 'I want to be a better father', 'Create an Engineering group in Newco', 'Add my wife Jennifer, jennifer@example.com'.",
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
