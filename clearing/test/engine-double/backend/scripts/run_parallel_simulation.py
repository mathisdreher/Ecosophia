"""A test double of the MiroFish simulation runner, written for Ecosophia.

It is NOT MiroFish and simulates nothing of interest. It follows the same
file protocol as the pinned runner (config and profile files in, action log
and status file out, commands through ipc_commands/ and ipc_responses/) and
calls the model endpoint in the same wire format, so that the Ecosophia side
of the pipeline can be tested in seconds with the Python standard library.

    python run_parallel_simulation.py --config <dir>/simulation_config.json --reddit-only --max-rounds 2
"""
import argparse
import json
import os
import time
import urllib.request
from datetime import datetime

parser = argparse.ArgumentParser()
parser.add_argument("--config", required=True)
parser.add_argument("--reddit-only", action="store_true")
parser.add_argument("--max-rounds", type=int, default=None)
args = parser.parse_args()

sim = os.path.dirname(os.path.abspath(args.config))
with open(args.config, encoding="utf-8") as f:
    config = json.load(f)
with open(os.path.join(sim, "reddit_profiles.json"), encoding="utf-8") as f:
    profiles = json.load(f)

BASE = os.environ["LLM_BASE_URL"].rstrip("/")
MODEL = os.environ.get("LLM_MODEL_NAME") or config.get("llm_model", "")
names = {c["agent_id"]: c["entity_name"] for c in config["agent_configs"]}


def system_prompt(p):
    # Same template as the engine's threaded platform, demographics sentence included.
    return (
        "\n# OBJECTIVE\nYou're a Reddit user, and I'll present you with some tweets. "
        "After you see the tweets, choose some actions from the following functions.\n\n"
        "# SELF-DESCRIPTION\nYour actions should be consistent with your self-description and personality.\n"
        f"Your name is {p['username']}.\nYour have profile: {p['persona']}."
        f"You are a {p['gender']}, {p['age']} years old, with an MBTI personality type of {p['mbti']} from {p['country']}.\n\n"
        "# RESPONSE METHOD\nPlease perform actions by tool calling.\n"
    )


def tool(name, description, properties, required):
    return {"type": "function", "function": {"name": name, "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required}}}


TOOLS = [
    tool("create_post", "Create a new post.", {"content": {"type": "string"}}, ["content"]),
    tool("create_comment", "Comment on a post.", {"post_id": {"type": "integer"}, "content": {"type": "string"}}, ["post_id", "content"]),
    tool("like_comment", "Like a comment.", {"comment_id": {"type": "integer"}}, ["comment_id"]),
    tool("dislike_comment", "Dislike a comment.", {"comment_id": {"type": "integer"}}, ["comment_id"]),
    tool("do_nothing", "Perform no action.", {}, []),
]


def chat(messages, tools=None):
    body = {"model": MODEL, "messages": messages}
    if tools:
        body["tools"] = tools
    req = urllib.request.Request(f"{BASE}/chat/completions", data=json.dumps(body).encode("utf-8"),
                                 headers={"content-type": "application/json", "authorization": "Bearer test"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(req, timeout=600) as res:
        return json.load(res)["choices"][0]["message"]


os.makedirs(os.path.join(sim, "reddit"), exist_ok=True)
log_path = os.path.join(sim, "reddit", "actions.jsonl")


def log(entry):
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": datetime.now().isoformat(), **entry}, ensure_ascii=False) + "\n")


def log_action(round_num, agent_id, action_type, action_args):
    log({"round": round_num, "agent_id": agent_id, "agent_name": names.get(agent_id, f"Agent_{agent_id}"),
         "action_type": action_type, "action_args": action_args, "result": None, "success": True})


posts, comments = [], []
memory = {i: [{"role": "system", "content": system_prompt(p)}] for i, p in enumerate(profiles)}

log({"round": 0, "event_type": "round_start", "simulated_hour": 0})
for post in config["event_config"]["initial_posts"]:
    posts.append({"post_id": len(posts) + 1, "user_id": post["poster_agent_id"], "content": post["content"]})
    log_action(0, post["poster_agent_id"], "CREATE_POST", {"content": post["content"]})
log({"round": 0, "event_type": "round_end", "actions_count": len(posts)})

rounds = config["time_config"]["total_simulation_hours"] * 60 // config["time_config"]["minutes_per_round"]
if args.max_rounds:
    rounds = min(rounds, args.max_rounds)

for r in range(1, rounds + 1):
    log({"round": r, "event_type": "round_start", "simulated_hour": (r - 1) % 24})
    done = 0
    for c in config["agent_configs"]:
        agent_id = c["agent_id"]
        if c.get("activity_level", 0) <= 0:
            continue
        feed = [{**p, "comments": [x for x in comments if x["post_id"] == p["post_id"]]} for p in posts]
        memory[agent_id].append({"role": "user", "content": "Please perform social media actions after observing the platform environments. "
                                 f"Here is your social media environment: After refreshing, you see some posts {json.dumps(feed, indent=4)}"})
        try:
            answer = chat(memory[agent_id], TOOLS)
        except Exception as e:  # the engine logs a failed agent turn and goes on
            print(f"agent {agent_id} error: {e}")
            memory[agent_id].pop()
            continue
        memory[agent_id].append({"role": "assistant", "content": answer.get("content") or "", "tool_calls": answer.get("tool_calls") or []})
        for call in answer.get("tool_calls") or []:
            name = call["function"]["name"]
            a = json.loads(call["function"]["arguments"] or "{}")
            result = {"success": True}
            if name == "create_comment":
                comment = {"comment_id": len(comments) + 1, "post_id": a["post_id"], "user_id": agent_id, "content": a["content"]}
                comments.append(comment)
                post = next((p for p in posts if p["post_id"] == a["post_id"]), None)
                log_action(r, agent_id, "CREATE_COMMENT", {"content": a["content"], "post_id": a["post_id"],
                           "post_content": post["content"] if post else "", "post_author_name": names.get(post["user_id"], "") if post else ""})
                done += 1
            elif name in ("like_comment", "dislike_comment"):
                target = next((x for x in comments if x["comment_id"] == a["comment_id"]), None)
                if target:
                    log_action(r, agent_id, name.upper(), {"comment_id": a["comment_id"], "comment_content": target["content"],
                               "comment_author_name": names.get(target["user_id"], "")})
                    done += 1
            elif name == "create_post":
                posts.append({"post_id": len(posts) + 1, "user_id": agent_id, "content": a["content"]})
                log_action(r, agent_id, "CREATE_POST", {"content": a["content"]})
                done += 1
            memory[agent_id].append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result)})
    log({"round": r, "event_type": "round_end", "actions_count": done})


def status(value):
    with open(os.path.join(sim, "env_status.json"), "w", encoding="utf-8") as f:
        json.dump({"status": value, "twitter_available": False, "reddit_available": True, "timestamp": datetime.now().isoformat()}, f)


commands_dir = os.path.join(sim, "ipc_commands")
responses_dir = os.path.join(sim, "ipc_responses")
os.makedirs(commands_dir, exist_ok=True)
os.makedirs(responses_dir, exist_ok=True)
status("alive")

deadline = time.time() + 600
running = True
while running and time.time() < deadline:
    for name in sorted(os.listdir(commands_dir)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(commands_dir, name)
        try:
            with open(path, encoding="utf-8") as f:
                command = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        response = {"command_id": command["command_id"], "status": "completed", "result": None, "error": None, "timestamp": datetime.now().isoformat()}
        if command["command_type"] == "batch_interview":
            results = {}
            for item in command["args"]["interviews"]:
                agent_id = item["agent_id"]
                answer = chat([memory[agent_id][0]] + memory[agent_id] + [{"role": "user", "content": item["prompt"]}])
                results[f"reddit_{agent_id}"] = {"agent_id": agent_id, "response": answer.get("content"), "timestamp": datetime.now().isoformat(), "platform": "reddit"}
            response["result"] = {"interviews_count": len(results), "results": results}
        elif command["command_type"] == "close_env":
            response["result"] = {"message": "closing"}
            running = False
        else:
            response.update(status="failed", error=f"unknown command {command['command_type']}")
        with open(os.path.join(responses_dir, f"{command['command_id']}.json"), "w", encoding="utf-8") as f:
            json.dump(response, f, ensure_ascii=False)
        os.remove(path)
    time.sleep(0.2)

status("stopped")
