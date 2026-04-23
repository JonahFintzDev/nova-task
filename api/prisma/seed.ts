import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  PrismaClient,
  Priority,
  ListSharePermission,
} from "../src/generated/client/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mistral AI integration
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const USE_AI =
  MISTRAL_API_KEY && MISTRAL_API_KEY !== "your_mistral_api_key_here";

// Track AI generation failures
const aiFailures: string[] = [];

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function generateAIContent(
  prompt: string,
  context: string = "content",
): Promise<string> {
  if (!USE_AI) {
    throw new Error("Mistral API key not configured");
  }

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.statusText}`);
    }

    const data = (await response.json()) as MistralResponse;
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.warn(
      `AI generation failed for ${context}, falling back to faker:`,
      error,
    );
    aiFailures.push(context);
    throw error;
  }
}

async function generateTaskTitle(
  listName: string,
  category: string,
  existingTasks: string[] = [],
): Promise<string> {
  const existingTasksText =
    existingTasks.length > 0
      ? `Existing tasks: ${existingTasks.join(", ")}.`
      : "";
  const prompt = `Generate a realistic task title for a list called "${listName}" in the ${category.toLowerCase()} category. ${existingTasksText} Make the new task different from existing tasks. Just the title, no quotes.`;

  try {
    return await generateAIContent(
      prompt,
      `task title (${listName} - ${category})`,
    );
  } catch {
    // Fallback to faker
    return randomItem(taskTitles);
  }
}

async function generateTaskDescription(
  listName: string,
  category: string,
): Promise<string> {
  const prompt = `Generate a brief task description for a list called "${listName}" in the ${category.toLowerCase()} category (1-2 sentences, max 100 chars).`;

  try {
    return await generateAIContent(
      prompt,
      `task description (${listName} - ${category})`,
    );
  } catch {
    // Fallback to faker
    return randomItem(taskDescriptions);
  }
}

async function generateListTitle(category: string): Promise<string> {
  const categoryPrompts: Record<string, string> = {
    Work: "Generate a short work list title (1-2 words, e.g., 'Projects', 'Tasks'). Just the title, no quotes.",
    Personal:
      "Generate a short personal list title (1-2 words, e.g., 'Home', 'Family'). Just the title, no quotes.",
    Shopping:
      "Generate a short shopping list title (1-2 words, e.g., 'Groceries', 'Party'). Just the title, no quotes.",
    Home: "Generate a short home list title (1-2 words, e.g., 'Repairs', 'Garden'). Just the title, no quotes.",
    Health:
      "Generate a short health list title (1-2 words, e.g., 'Fitness', 'Medical'). Just the title, no quotes.",
    Finance:
      "Generate a short finance list title (1-2 words, e.g., 'Bills', 'Investments'). Just the title, no quotes.",
    Learning:
      "Generate a short learning list title (1-2 words, e.g., 'Courses', 'Reading'). Just the title, no quotes.",
    Projects:
      "Generate a short project list title (1-2 words, e.g., 'Website', 'App'). Just the title, no quotes.",
  };

  const prompt = categoryPrompts[category] || categoryPrompts["Personal"];

  try {
    return await generateAIContent(prompt, `list title (${category})`);
  } catch {
    // Fallback
    return `${category} - ${faker.word.adjective()}`;
  }
}

async function generateTagName(): Promise<string> {
  try {
    return await generateAIContent(
      "Generate a short, descriptive tag name (1-2 words, e.g., 'urgent', 'important', 'review'). Just the name, no quotes.",
      "tag name",
    );
  } catch {
    // Fallback
    return randomItem(tagNames);
  }
}

async function generateComment(): Promise<string> {
  try {
    return await generateAIContent(
      "Generate a brief task comment (1-2 sentences, e.g., 'I can take this one', 'This looks great'). Just the comment, no quotes.",
      "comment",
    );
  } catch {
    // Fallback
    return randomItem(comments);
  }
}

async function generateActivityDetail(): Promise<string> {
  try {
    return await generateAIContent(
      "Generate a brief activity detail (1-2 words, e.g., 'priority changed', 'due date updated'). Just the detail, no quotes.",
      "activity detail",
    );
  } catch {
    // Fallback
    return randomItem(activities);
  }
}

// Helper: Random item from array
const randomItem = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

// Helper: Random subset of array
const randomSubset = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Sample data for realistic content
const listCategories = ["Personal", "Work", "Health", "Learning"];

const hardcodedLists: Record<string, string[]> = {
  Personal: ["Shopping", "Family", "Planning"],
  Work: ["EWS", "Freelance"],
  Health: [],
  Learning: [],
};
const listIcons = [
  "check_circle",
  "star",
  "work",
  "home",
  "shopping_cart",
  "favorite",
  "school",
  "fitness_center",
  "travel_explore",
  "code",
  "book",
  "lightbulb",
  "event",
  "restaurant",
  "directions_car",
  "pets",
];
const listColors = [
  "#ff2d55",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#5ac8fa",
  "#007aff",
  "#5856d6",
  "#ff2d55",
  "#8e8e93",
];
const tagNames = [
  "urgent",
  "important",
  "later",
  "maybe",
  "waiting",
  "review",
  "bug",
  "feature",
  "research",
  "meeting",
];
const taskTitles = [
  "Complete project proposal",
  "Review pull requests",
  "Schedule team meeting",
  "Update documentation",
  "Fix navigation bug",
  "Design new dashboard",
  "Implement user auth",
  "Write unit tests",
  "Deploy to production",
  "Optimize database queries",
  "Create API documentation",
  "Set up CI/CD pipeline",
  "Review security audit",
  "Update dependencies",
  "Migrate to new framework",
  "Design marketing materials",
  "Plan sprint roadmap",
  "Conduct user research",
  "Analyze metrics",
  "Prepare presentation",
];
const taskDescriptions = [
  "Need to finish this by end of week",
  "Waiting for approval from stakeholders",
  "High priority item for Q4",
  "Blocker for other tasks",
  "Requires coordination with design team",
  "Technical debt that should be addressed",
  "User feedback suggests this improvement",
  "Part of the onboarding flow",
  "Critical for the upcoming release",
  "Nice to have if time permits",
];
const comments = [
  "I think we should prioritize this",
  "Can we discuss this in the next meeting?",
  "Done! Ready for review",
  "I found a potential issue here",
  "This looks great, just one small suggestion",
  "Let me know if you need help",
  "Updated the approach based on feedback",
  "This is blocked by the API changes",
  "I can take this one",
  "Documentation has been updated",
];
const activities = [
  "created",
  "updated",
  "deleted",
  "completed",
  "reopened",
  "commented on",
  "assigned",
  "moved",
  "archived",
  "restored",
];

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data (in reverse order of dependencies)
  console.log("🧹 Clearing existing data...");
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.listShare.deleteMany();
  await prisma.list.deleteMany();
  await prisma.recurringRule.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.calendarFeedList.deleteMany();
  await prisma.calendarFeedToken.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSettings.deleteMany();

  // Create AppSettings
  console.log("⚙️  Creating AppSettings...");
  await prisma.appSettings.create({
    data: {
      key: "registrationEnabled",
      value: "true",
    },
  });

  // Create Users
  console.log("👤 Creating users...");
  const users = [];
  const passwordHash = await bcrypt.hash("password123", 10);

  // Admin user
  const adminUser = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash,
      isAdmin: true,
      language: "en",
      autoTheme: true,
      darkTheme: "deep-space",
      lightTheme: "cloud",
    },
  });
  users.push(adminUser);

  // Regular users
  for (let i = 0; i < 4; i++) {
    const user = await prisma.user.create({
      data: {
        username: faker.internet.username().toLowerCase(),
        passwordHash,
        isAdmin: false,
        language: randomItem(["en", "de"]),
        autoTheme: faker.datatype.boolean(),
        darkTheme: randomItem([
          "deep-space",
          "carbon",
          "terminal-green",
          "midnight-violet",
          "ember",
        ]),
        lightTheme: randomItem(["cloud", "cream", "frost", "sakura"]),
        avatarExt: randomItem(["jpg", "png", null]),
      },
    });
    users.push(user);
  }

  // Create API Keys for some users
  console.log("🔑 Creating API keys...");
  for (const user of randomSubset(users, 3)) {
    await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: `${user.username}'s API Key`,
        keyHash: faker.string.uuid(),
        keyPrefix: "nt_" + faker.string.alphanumeric(8),
      },
    });
  }

  // Create Tags for each user
  console.log("🏷️  Creating tags...");
  const userTags: Record<string, any[]> = {};
  for (const user of users) {
    const tags = [];
    const existingTagNames = new Set<string>();
    for (let i = 0; i < 5; i++) {
      let tagName: string;
      let attempts = 0;
      do {
        tagName = USE_AI ? await generateTagName() : randomItem(tagNames);
        attempts++;
        if (attempts > 5) {
          // Fallback to a unique name if AI keeps generating duplicates
          tagName = `tag-${i}-${faker.string.alphanumeric(4)}`;
          break;
        }
      } while (existingTagNames.has(tagName));

      existingTagNames.add(tagName);
      const tag = await prisma.tag.create({
        data: {
          userId: user.id,
          name: tagName,
          color: randomItem(listColors),
        },
      });
      tags.push(tag);
    }
    userTags[user.id] = tags;
  }

  // Create Lists for each user
  console.log("📋 Creating lists...");
  const userLists: Record<string, any[]> = {};
  for (const user of users) {
    const lists = [];
    let sortOrder = 0;

    // Create hardcoded lists for Personal and Work categories
    for (const category of ["Personal", "Work"]) {
      const listNames = hardcodedLists[category] || [];
      for (const listName of listNames) {
        const list = await prisma.list.create({
          data: {
            userId: user.id,
            title: listName,
            icon: randomItem(listIcons),
            color: randomItem(listColors),
            category: category,
            commentsEnabled: faker.datatype.boolean(),
            sortOrder: sortOrder++,
          },
        });
        lists.push(list);
      }
    }

    // Create random lists for remaining categories (Health, Learning)
    const remainingCategories = listCategories.filter(
      (c) => !["Personal", "Work"].includes(c),
    );
    for (const category of remainingCategories) {
      const listCount = faker.number.int({ min: 2, max: 3 });
      for (let i = 0; i < listCount; i++) {
        const listTitle = USE_AI
          ? await generateListTitle(category)
          : `${category} - ${faker.word.adjective()}`;
        const list = await prisma.list.create({
          data: {
            userId: user.id,
            title: listTitle,
            icon: randomItem(listIcons),
            color: randomItem(listColors),
            category: category,
            commentsEnabled: faker.datatype.boolean(),
            sortOrder: sortOrder++,
          },
        });
        lists.push(list);
      }
    }

    userLists[user.id] = lists;
  }

  // Create List Shares (share some lists between users)
  console.log("🤝 Creating list shares...");
  for (let i = 0; i < 5; i++) {
    const fromUser = randomItem(users);
    const toUser = randomItem(users.filter((u) => u.id !== fromUser.id));
    const list = randomItem(userLists[fromUser.id]);

    try {
      await prisma.listShare.create({
        data: {
          listId: list.id,
          userId: toUser.id,
          permission: randomItem([
            ListSharePermission.READ,
            ListSharePermission.WRITE,
            ListSharePermission.ADMIN,
          ]),
          invitedById: fromUser.id,
        },
      });
    } catch (e) {
      // Ignore duplicate share errors
    }
  }

  // Create Tasks with subtasks, tags, and various properties
  console.log("✅ Creating tasks...");
  const priorities: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];
  const allTasks: any[] = [];

  for (const user of users) {
    for (const list of userLists[user.id]) {
      // Create 5-10 tasks per list
      const taskCount = faker.number.int({ min: 5, max: 10 });
      const existingTaskTitles: string[] = [];

      for (let i = 0; i < taskCount; i++) {
        const hasDueDate = faker.datatype.boolean();
        const dueDate = hasDueDate ? faker.date.future({ years: 0.5 }) : null;
        const isDone = faker.datatype.boolean({ probability: 0.3 });

        const taskTitle = USE_AI
          ? await generateTaskTitle(
              list.title,
              list.category,
              existingTaskTitles,
            )
          : randomItem(taskTitles);

        const taskDescription =
          USE_AI && faker.datatype.boolean()
            ? await generateTaskDescription(list.title, list.category)
            : faker.datatype.boolean()
              ? randomItem(taskDescriptions)
              : null;

        existingTaskTitles.push(taskTitle);

        const task = await prisma.task.create({
          data: {
            listId: list.id,
            userId: user.id,
            title: taskTitle,
            description: taskDescription,
            dueDate,
            dueDateHasTime: hasDueDate && faker.datatype.boolean(),
            priority: randomItem(priorities),
            done: isDone,
            doneAt: isDone ? faker.date.recent({ days: 30 }) : null,
            sortOrder: i,
            assignedToUserId: faker.datatype.boolean({ probability: 0.3 })
              ? randomItem(users).id
              : null,
          },
        });
        allTasks.push(task);

        // Add tags to task
        const userTagList = userTags[user.id];
        if (userTagList && userTagList.length > 0) {
          const tagsToAdd = randomSubset(
            userTagList,
            faker.number.int({ min: 0, max: 3 }),
          );
          for (const tag of tagsToAdd) {
            await prisma.taskTag.create({
              data: {
                taskId: task.id,
                tagId: tag.id,
              },
            });
          }
        }
      }
    }
  }

  // Create subtasks (nested tasks)
  console.log("📝 Creating subtasks...");
  const parentTasks = randomSubset(
    allTasks.filter((t) => !t.done),
    10,
  );
  for (const parentTask of parentTasks) {
    const subtaskCount = faker.number.int({ min: 2, max: 4 });
    const existingSubtaskTitles: string[] = [];

    // Find the list for this task to get the category
    const parentList = Object.values(userLists)
      .flat()
      .find((l) => l.id === parentTask.listId);
    const category = parentList?.category || "Personal";

    for (let i = 0; i < subtaskCount; i++) {
      const isDone = faker.datatype.boolean({ probability: 0.4 });

      const subtaskTitle = USE_AI
        ? await generateTaskTitle(
            parentList?.title || "Tasks",
            category,
            existingSubtaskTitles,
          )
        : randomItem(taskTitles);

      existingSubtaskTitles.push(subtaskTitle);

      const subtaskDescription =
        USE_AI && faker.datatype.boolean()
          ? await generateTaskDescription(
              parentList?.title || "Tasks",
              category,
            )
          : faker.datatype.boolean()
            ? randomItem(taskDescriptions)
            : null;

      await prisma.task.create({
        data: {
          listId: parentTask.listId,
          userId: parentTask.userId,
          title: subtaskTitle,
          description: subtaskDescription,
          dueDate: parentTask.dueDate,
          dueDateHasTime: parentTask.dueDateHasTime,
          priority: randomItem(priorities),
          done: isDone,
          doneAt: isDone ? faker.date.recent({ days: 7 }) : null,
          sortOrder: i,
          parentTaskId: parentTask.id,
        },
      });
    }
  }

  // Create Comments on tasks
  console.log("💬 Creating comments...");
  const tasksWithComments = randomSubset(allTasks, 15);
  for (const task of tasksWithComments) {
    const commentCount = faker.number.int({ min: 1, max: 4 });
    for (let i = 0; i < commentCount; i++) {
      const commenter = randomItem(users);
      const commentContent = USE_AI
        ? await generateComment()
        : randomItem(comments);
      await prisma.comment.create({
        data: {
          taskId: task.id,
          userId: commenter.id,
          content: commentContent,
        },
      });
    }
  }

  // Create Activity Logs
  console.log("📊 Creating activity logs...");
  for (const user of users) {
    const activityCount = faker.number.int({ min: 5, max: 15 });
    for (let i = 0; i < activityCount; i++) {
      const task = randomItem(allTasks);
      const action = USE_AI
        ? await generateActivityDetail()
        : randomItem(activities);
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          taskId: task.id,
          listId: task.listId,
          action: action,
          details: faker.datatype.boolean()
            ? randomItem(taskDescriptions)
            : null,
          createdAt: faker.date.recent({ days: 30 }),
        },
      });
    }
  }

  // Create Recurring Rules for some tasks
  console.log("🔄 Creating recurring rules...");
  const recurringTasks = randomSubset(
    allTasks.filter((t) => !t.done),
    5,
  );
  const frequencies = ["daily", "weekly", "biweekly", "monthly"];
  for (const task of recurringTasks) {
    await prisma.recurringRule.create({
      data: {
        taskId: task.id,
        userId: task.userId,
        frequency: randomItem(frequencies),
        interval: faker.number.int({ min: 1, max: 3 }),
        streak: faker.number.int({ min: 0, max: 10 }),
      },
    });
  }

  // Create Push Subscriptions
  console.log("🔔 Creating push subscriptions...");
  for (const user of randomSubset(users, 3)) {
    await prisma.pushSubscription.create({
      data: {
        id: faker.string.uuid(),
        userId: user.id,
        endpoint: faker.internet.url(),
        p256dh: faker.string.hexadecimal({ length: 64 }),
        auth: faker.string.hexadecimal({ length: 24 }),
      },
    });
  }

  // Create Calendar Feed Tokens
  console.log("📅 Creating calendar feed tokens...");
  for (const user of randomSubset(users, 3)) {
    const feed = await prisma.calendarFeedToken.create({
      data: {
        userId: user.id,
        name: `${user.username}'s Calendar`,
        tokenHash: faker.string.uuid(),
        includeDone: faker.datatype.boolean(),
        isActive: true,
        expiresAt: faker.date.future({ years: 1 }),
      },
    });

    // Add some lists to the feed
    const listsToAdd = randomSubset(
      userLists[user.id],
      faker.number.int({ min: 1, max: 3 }),
    );
    for (const list of listsToAdd) {
      await prisma.calendarFeedList.create({
        data: {
          feedId: feed.id,
          listId: list.id,
        },
      });
    }
  }

  console.log("✅ Seed completed successfully!");
  console.log("");
  console.log("📊 Summary:");
  console.log(`   Users: ${users.length}`);
  console.log(`   Lists: ${Object.values(userLists).flat().length}`);
  console.log(`   Tasks: ${allTasks.length}`);
  console.log(`   Tags: ${Object.values(userTags).flat().length}`);
  console.log("");

  if (USE_AI) {
    if (aiFailures.length > 0) {
      console.log("⚠️  AI Generation Warnings:");
      console.log(`   ${aiFailures.length} item(s) fell back to faker data`);
      console.log(
        `   Failed categories: ${[...new Set(aiFailures)].join(", ")}`,
      );
    } else {
      console.log("🤖 AI Generation: All content generated successfully");
    }
  } else {
    console.log("ℹ️  AI Generation: Disabled (MISTRAL_API_KEY not set)");
  }

  console.log("");
  console.log("🔐 Login credentials:");
  console.log("   Username: admin");
  console.log("   Password: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
