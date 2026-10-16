#!/usr/bin/env bash
# Pulls the contribution calendar and pinned repos into public/data/github.json, and each pinned repo's README
# (rendered by GitHub) into public/data/readme/<repo>.html. Needs `gh auth login`.
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/public/data/github.json"
mkdir -p "$(dirname "$OUT")"

gh api graphql -f login="${1:-theobourgeois}" -f query='
query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes { ... on Repository { name description url stargazerCount defaultBranchRef { name } } }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date weekday contributionCount contributionLevel } }
      }
    }
  }
}' --jq '.data.user | {
  total: .contributionsCollection.contributionCalendar.totalContributions,
  weeks: [.contributionsCollection.contributionCalendar.weeks[] | [.contributionDays[] | {
    date, weekday, count: .contributionCount,
    level: ({"NONE": 0, "FIRST_QUARTILE": 1, "SECOND_QUARTILE": 2, "THIRD_QUARTILE": 3, "FOURTH_QUARTILE": 4}[.contributionLevel])
  }]],
  pinned: [.pinnedItems.nodes[] | {
    name, description, url, stars: .stargazerCount, branch: .defaultBranchRef.name
  }]
}' > "$OUT"

echo "wrote $OUT"

README_DIR="$(dirname "$OUT")/readme"
rm -rf "$README_DIR" && mkdir -p "$README_DIR"
python3 -I -c 'import json, sys; print("\n".join(r["url"].removeprefix("https://github.com/") for r in json.load(open(sys.argv[1]))["pinned"]))' "$OUT" |
  while read -r repo; do
    if gh api "repos/$repo/readme" -H "Accept: application/vnd.github.html" > "$README_DIR/${repo#*/}.html" 2>/dev/null; then
      echo "wrote readme for $repo"
    else
      rm -f "$README_DIR/${repo#*/}.html"
      echo "no readme for $repo"
    fi
  done
