/* eslint-disable no-console, compat/compat */
const fs = require("fs");

// Read the API Token from environment variables
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const COOLIFY_IP = "91.99.118.130";

if (!CF_API_TOKEN) {
  console.error(
    "❌ Missing CF_API_TOKEN! Please add it to your .env file or export it.",
  );
  process.exit(1);
}

const domain = process.argv[2];

if (!domain) {
  console.error(
    "❌ Please provide a domain! Example: node --env-file=.env scripts/setup-cloudflare.js example.com",
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${CF_API_TOKEN}`,
  "Content-Type": "application/json",
};

async function handleRequest(name, url, options) {
  console.log("\n========================================");
  console.log(`⏳ Executing: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`Method: ${options.method}`);

  try {
    const res = await fetch(url, options);
    const text = await res.text();

    console.log(`Response Status: ${res.status}`);
    console.log("Response Body:");
    console.log(text);
    console.log("========================================\n");

    try {
      const data = JSON.parse(text);
      if (!data.success) {
        // Ignore "An identical record already exists" error for cleaner output
        const isAlreadyExists =
          data.errors && data.errors.some((e) => e.code === 81058);
        if (isAlreadyExists) {
          console.log(`✅ Success: [${name}] (Record already existed)`);
        } else {
          console.error(
            `❌ Error during [${name}]:`,
            JSON.stringify(data.errors, null, 2),
          );
        }
      } else {
        console.log(`✅ Success: [${name}]`);
      }
      return data;
    } catch (e) {
      return null;
    }
  } catch (err) {
    console.error(`❌ Network Error during [${name}]:`, err.message);
  }
}

async function run() {
  console.log(`🚀 Starting automated Cloudflare setup for ${domain}...`);

  // 1. Get Zone ID
  const zoneRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
    { headers },
  );
  const zoneText = await zoneRes.text();
  const zoneData = JSON.parse(zoneText);

  if (!zoneData.success || zoneData.result.length === 0) {
    console.error(`❌ Domain ${domain} not found or token lacks permissions.`);
    console.error("Response:", zoneText);
    return;
  }
  const zoneId = zoneData.result[0].id;
  console.log(`✅ Found Zone ID: ${zoneId}`);

  // 2. Create Naked A Record
  await handleRequest(
    "Creating naked A record",
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "A",
        name: domain,
        content: COOLIFY_IP,
        proxied: true,
      }),
    },
  );

  // 3. Create WWW A Record
  await handleRequest(
    "Creating www A record",
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "A",
        name: `www.${domain}`,
        content: COOLIFY_IP,
        proxied: true,
      }),
    },
  );

  // 4. Enable Always Use HTTPS
  await handleRequest(
    "Enabling Always Use HTTPS",
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/always_use_https`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ value: "on" }),
    },
  );

  // 5. Create 301 Redirect Rule
  console.log("⏳ Setting up 301 Redirect Rule...");
  const rulePayload = {
    description: "Redirect root to WWW",
    expression: `(http.host eq "${domain}")`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: {
          expression: `concat("https://www.${domain}", http.request.uri.path)`,
        },
        preserve_query_string: true,
      },
    },
    enabled: true,
  };

  const rulesetsRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`,
    { headers },
  );
  const rulesetsData = await rulesetsRes.json();
  const dynamicRedirectRuleset = rulesetsData.success
    ? rulesetsData.result.find(
        (r) => r.phase === "http_request_dynamic_redirect",
      )
    : null;

  if (dynamicRedirectRuleset) {
    await handleRequest(
      "Appending 301 Rule to existing ruleset",
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${dynamicRedirectRuleset.id}/rules`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(rulePayload),
      },
    );
  } else {
    await handleRequest(
      "Creating new Redirect Ruleset phase",
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "default",
          kind: "zone",
          phase: "http_request_dynamic_redirect",
          description: "Zone Ruleset for Dynamic Redirects",
          rules: [rulePayload],
        }),
      },
    );
  }
}

run();
/* eslint-enable no-console, compat/compat */
