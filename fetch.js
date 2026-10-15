fs = require("fs");
const https = require("https");
process = require("process");
require("dotenv").config();

const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const USE_GITHUB_DATA = process.env.USE_GITHUB_DATA;
const MEDIUM_USERNAME = process.env.MEDIUM_USERNAME;

const ERR = {
  noUserName:
    "Github Username was found to be undefined. Please set all relevant environment variables.",
  requestFailed:
    "The request to GitHub didn't succeed. Check if GitHub token in your .env file is correct.",
  requestFailedMedium:
    "The request to Medium didn't succeed. Check if Medium username in your .env file is correct."
};
if (USE_GITHUB_DATA === "true") {
  if (GITHUB_USERNAME === undefined) {
    throw new Error(ERR.noUserName);
  }

  console.log(`Fetching profile data for ${GITHUB_USERNAME}`);
  var data = JSON.stringify({
    query: `
{
  user(login:"${GITHUB_USERNAME}") { 
    name
    bio
    avatarUrl
    location
    pinnedItems(first: 6, types: [REPOSITORY]) {
      totalCount
      edges {
          node {
            ... on Repository {
              name
              description
              forkCount
              stargazerCount
              url
              id
              diskUsage
              primaryLanguage {
                name
                color
              }
            }
          }
        }
      }
    }
}
`
  });
  const default_options = {
    hostname: "api.github.com",
    path: "/graphql",
    port: 443,
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "Node"
    }
  };

  const req = https.request(default_options, res => {
    let data = "";

    console.log(`statusCode: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      throw new Error(ERR.requestFailed);
    }

    res.on("data", d => {
      data += d;
    });
    res.on("end", () => {
      let profile;
      try {
        profile = JSON.parse(data);
      } catch (error) {
        console.error(error);
        process.exit(1);
      }

      if (profile.errors && profile.errors.length) {
        console.error(JSON.stringify(profile.errors, null, 2));
        process.exit(1);
      }

      const edges =
        profile.data &&
        profile.data.user &&
        profile.data.user.pinnedItems &&
        profile.data.user.pinnedItems.edges;
      if (!edges) {
        console.error(ERR.requestFailed);
        process.exit(1);
      }

      edges.forEach(edge => {
        const node = edge && edge.node;
        if (!node || typeof node.stargazerCount !== "number") {
          console.error(ERR.requestFailed);
          process.exit(1);
        }
        const next = {};
        Object.keys(node).forEach(key => {
          if (key === "stargazerCount") {
            next.stargazers = {totalCount: node.stargazerCount};
          } else {
            next[key] = node[key];
          }
        });
        edge.node = next;
      });

      fs.writeFile(
        "./public/profile.json",
        JSON.stringify(profile),
        function (err) {
          if (err) {
            console.log(err);
            process.exit(1);
          }
          console.log("saved file to public/profile.json");
        }
      );
    });
  });

  req.on("error", error => {
    throw error;
  });

  req.write(data);
  req.end();
}

if (MEDIUM_USERNAME !== undefined) {
  console.log(`Fetching Medium blogs data for ${MEDIUM_USERNAME}`);
  const options = {
    hostname: "api.rss2json.com",
    path: `/v1/api.json?rss_url=https://medium.com/feed/@${MEDIUM_USERNAME}`,
    port: 443,
    method: "GET"
  };

  const req = https.request(options, res => {
    let mediumData = "";

    console.log(`statusCode: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      throw new Error(ERR.requestMediumFailed);
    }

    res.on("data", d => {
      mediumData += d;
    });
    res.on("end", () => {
      fs.writeFile("./public/blogs.json", mediumData, function (err) {
        if (err) return console.log(err);
        console.log("saved file to public/blogs.json");
      });
    });
  });

  req.on("error", error => {
    throw error;
  });

  req.end();
}
