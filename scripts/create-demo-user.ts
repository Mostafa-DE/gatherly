import { or, eq } from "drizzle-orm";
import { auth } from "../src/auth";
import { db } from "../src/db";
import { user } from "../src/db/schema";

const DEMO_USER = {
  username: "mostafade",
  name: "Mostafa DE",
  email: "mostafa@example.com",
  password: "password123",
  phoneNumber: "+1234567890",
} as const;

async function createDemoUser() {
  const existing = await db
    .select({
      id: user.id,
      username: user.username,
      email: user.email,
    })
    .from(user)
    .where(
      or(eq(user.email, DEMO_USER.email), eq(user.username, DEMO_USER.username))
    )
    .limit(1);

  if (existing[0]) {
    console.log(
      `Demo user already exists (${existing[0].username} / ${existing[0].email})`
    );
    return;
  }

  const result = await auth.api.signUpEmail({
    body: {
      username: DEMO_USER.username,
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      phoneNumber: DEMO_USER.phoneNumber,
    },
  });

  if (!result?.user?.id) {
    throw new Error("Failed to create demo user");
  }

  console.log(`Created demo user: ${result.user.email}`);
}

createDemoUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to create demo user: ${message}`);
    process.exit(1);
  });
