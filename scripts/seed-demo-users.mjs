import process from "node:process";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile?.(".env.local");
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEMO_INDIVIDUAL_PASSWORD",
  "DEMO_UJ_STAFF_PASSWORD",
  "DEMO_VEHICLE_STAFF_PASSWORD",
];

const missingEnvironment = requiredEnvironment.filter(
  (name) => !process.env[name],
);

if (missingEnvironment.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnvironment.join(", ")}`,
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const demoUsers = [
  {
    displayName: "Naledi Demo",
    email: "demo.user@reqdocs.test",
    organizationId: null,
    password: process.env.DEMO_INDIVIDUAL_PASSWORD,
    role: "individual",
  },
  {
    displayName: "UJ Finance Demo Staff",
    email: "finance.staff@reqdocs.test",
    organizationId: "00000000-0000-4000-8000-000000000001",
    password: process.env.DEMO_UJ_STAFF_PASSWORD,
    role: "staff",
  },
  {
    displayName: "Vehicle Authority Demo Staff",
    email: "licensing.staff@reqdocs.test",
    organizationId: "00000000-0000-4000-8000-000000000002",
    password: process.env.DEMO_VEHICLE_STAFF_PASSWORD,
    role: "staff",
  },
];

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw error;
  }

  return data.users.find((user) => user.email === email);
}

async function seedUser(demoUser) {
  const existingUser = await findUserByEmail(demoUser.email);
  let userId = existingUser?.id;

  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { reqdocsDemoAccount: true },
      email_confirm: true,
      password: demoUser.password,
      user_metadata: { display_name: demoUser.displayName },
    });

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      app_metadata: { reqdocsDemoAccount: true },
      email: demoUser.email,
      email_confirm: true,
      password: demoUser.password,
      user_metadata: { display_name: demoUser.displayName },
    });

    if (error) {
      throw error;
    }

    userId = data.user.id;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    display_name: demoUser.displayName,
    id: userId,
    organization_id: demoUser.organizationId,
    role: demoUser.role,
  });

  if (profileError) {
    throw profileError;
  }

  console.log(`Seeded fictional ${demoUser.role} account: ${demoUser.email}`);
}

try {
  for (const demoUser of demoUsers) {
    await seedUser(demoUser);
  }
  console.log("ReqDocs demo accounts are ready.");
} catch (error) {
  console.error("Unable to seed ReqDocs demo accounts:", error.message);
  process.exitCode = 1;
}
