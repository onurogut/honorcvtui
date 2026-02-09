(function () {
  const data = window.CV_DATA;
  if (!data) {
    return;
  }

  const terminal = document.getElementById("terminal");
  const status = document.getElementById("status");
  const topPrompt = document.getElementById("prompt");

  const githubUser = parseGitHubUsername(data.profile.github);

  const state = {
    queue: [],
    running: false,
    observer: null
  };

  topPrompt.innerHTML =
    '<span class="prompt-user">root</span><span class="prompt-at">@honor</span><span class="prompt-path">:~$</span> <span class="prompt-cmd">tail -f onur_ogut.cv</span>';

  const blocks = buildBlocks();
  blocks.forEach((block, index) => {
    block.index = index;
    mountBlock(block);
  });

  observeBlocks();
  status.textContent = "[0] ready | Scroll to execute section commands";

  function parseGitHubUsername(url) {
    if (!url) {
      return "";
    }
    const clean = url.replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  }

  function formatDate(isoDate) {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) {
      return "unknown";
    }
    return d.toISOString().slice(0, 10);
  }

  function wrapText(text, lineWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > lineWidth) {
        if (current) {
          lines.push(current);
        }
        current = word;
      } else {
        current = candidate;
      }
    });

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  function formatList(items, marker) {
    return (items || []).map((item) => `${marker} ${item}`).join("\n");
  }

  function buildBlocks() {
    return [
      {
        key: "header",
        command: "cat profile.header",
        output: () => {
          const lines = [
            data.profile.name,
            data.profile.title,
            data.profile.location,
            ""
          ];
          return lines.join("\n");
        }
      },
      {
        key: "contact",
        command: "cat contact.info",
        output: () => {
          const lines = [
            `email    : ${data.profile.email}`,
            `phone    : ${data.profile.phone || "n/a"}`,
            `linkedin : ${data.profile.linkedin || "n/a"}`,
            `github   : ${data.profile.github || "n/a"}`,
            `website  : ${data.profile.website || "n/a"}`,
            ""
          ];
          return lines.join("\n");
        }
      },
      {
        key: "skills",
        command: "cat skills.list",
        output: () => `${formatList(data.skills, "▸")}\n`
      },
      {
        key: "education",
        command: "cat education.log",
        output: () => {
          const lines = [];
          data.education.forEach((edu, index) => {
            const isLast = index === data.education.length - 1;
            const branch = isLast ? "└──" : "├──";
            lines.push(`${branch} ${edu.school}`);
            lines.push(`    degree : ${edu.degree}`);
            if (edu.years) {
              lines.push(`    where  : ${edu.years}`);
            }
            if (edu.details) {
              wrapText(edu.details, 90).forEach((line) => lines.push(`    note   : ${line}`));
            }
          });
          lines.push("");
          return lines.join("\n");
        }
      },
      {
        key: "about",
        command: "man onur-ogut",
        output: () => {
          const lines = [
            "NAME",
            `    ${data.profile.name.toLowerCase()} - ${data.profile.title}`,
            "SYNOPSIS",
            `    ${data.profile.name.toLowerCase()} [--systems] [--security] [--devsecops]`,
            "DESCRIPTION"
          ];
          wrapText(data.about, 92).forEach((line) => lines.push(`    ${line}`));
          lines.push("");
          return lines.join("\n");
        }
      },
      {
        key: "experience",
        command: "journalctl -u career.service",
        output: () => {
          const lines = [];
          data.experience.forEach((job, index) => {
            const isLast = index === data.experience.length - 1;
            const branch = isLast ? "└──" : "├──";
            lines.push(`${branch} ${job.role} @ ${job.company}`);
            lines.push(`    period : ${job.period}`);
            job.highlights.forEach((item) => lines.push(`    - ${item}`));
            lines.push("    ");
          });
          return `${lines.join("\n")}\n`;
        }
      },
      {
        key: "languages",
        command: "cat languages.txt",
        output: () => `${formatList(data.languages, "▸")}\n`
      },
      {
        key: "certifications",
        command: "cat certifications.txt",
        output: () => `${formatList(data.certifications, "▸")}\n`
      },
      {
        key: "personal",
        command: "cat personal_information.txt",
        output: () => `${formatList(data.personalInfo, "▸")}\n`
      },
      {
        key: "projects",
        command: "git log --projects --oneline",
        output: () => {
          const lines = [];
          (data.projects || []).forEach((project, index) => {
            const isLast = index === data.projects.length - 1;
            const branch = isLast ? "└──" : "├──";
            lines.push(`${branch} ${project.name}`);
            lines.push(`    ${project.description}`);
            lines.push(`    ${project.link}`);
          });
          lines.push("");
          return lines.join("\n");
        }
      },
      {
        key: "script",
        command: "bash about_me.sh",
        output: () => `${(data.script || []).join("\n")}\n`
      },
      {
        key: "solve",
        command: "cat solve_me.txt",
        output: () => `solve_me: ${data.solveMe || "n/a"}\n`
      },
      {
        key: "repos",
        command: githubUser
          ? `curl -s https://api.github.com/users/${githubUser}/repos?sort=updated&per_page=12&type=owner`
          : "curl -s <github-user-missing>",
        output: async () => {
          if (!githubUser) {
            return "[error] GitHub username is not configured.\n";
          }
          const response = await fetch(
            `https://api.github.com/users/${githubUser}/repos?sort=updated&per_page=12&type=owner`,
            { headers: { Accept: "application/vnd.github+json" } }
          );
          if (!response.ok) {
            throw new Error(`GitHub API ${response.status}`);
          }
          const repos = await response.json();
          if (!Array.isArray(repos) || repos.length === 0) {
            return "No public repositories found.\n";
          }

          const lines = [];
          repos.forEach((repo, index) => {
            const isLast = index === repos.length - 1;
            const branch = isLast ? "└──" : "├──";
            const language = repo.language || "n/a";
            const stars = typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0;
            lines.push(`${branch} ${repo.name}  [${language}]  ★${stars}`);
            lines.push(`    updated: ${formatDate(repo.pushed_at)}`);
            lines.push(`    url    : ${repo.html_url}`);
            if (repo.description) {
              lines.push(`    desc   : ${repo.description}`);
            }
          });
          lines.push("");
          return lines.join("\n");
        }
      }
    ];
  }

  function mountBlock(block) {
    const el = document.createElement("section");
    el.className = "cmd-block";
    el.dataset.block = block.key;

    const line = document.createElement("div");
    line.className = "cmd-line";

    const prefix = document.createElement("span");
    prefix.className = "cmd-prefix";
    prefix.innerHTML =
      '<span class="prompt-user">root</span><span class="prompt-at">@honor</span><span class="prompt-path">:~$</span> ';

    const command = document.createElement("span");
    command.className = "cmd-text";

    const cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = "█";

    line.appendChild(prefix);
    line.appendChild(command);
    line.appendChild(cursor);

    const output = document.createElement("pre");
    output.className = "cmd-output";
    output.textContent = "";

    const sentinel = document.createElement("div");
    sentinel.className = "cmd-sentinel";

    el.appendChild(line);
    el.appendChild(output);
    el.appendChild(sentinel);
    terminal.appendChild(el);

    block.el = el;
    block.commandEl = command;
    block.cursorEl = cursor;
    block.outputEl = output;
    block.executed = false;
  }

  function observeBlocks() {
    state.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const block = blocks.find((item) => item.el === entry.target);
            if (!block || block.executed) {
              return;
            }
            enqueue(block.index);
          }
        });
      },
      { threshold: 0.2 }
    );

    blocks.forEach((block) => state.observer.observe(block.el));
  }

  function enqueue(index) {
    if (state.queue.includes(index)) {
      return;
    }
    state.queue.push(index);
    state.queue.sort((a, b) => a - b);
    runQueue();
  }

  async function runQueue() {
    if (state.running) {
      return;
    }
    state.running = true;
    while (state.queue.length > 0) {
      const index = state.queue.shift();
      const block = blocks[index];
      if (!block || block.executed) {
        continue;
      }
      await executeBlock(block);
    }
    state.running = false;
  }

  async function executeBlock(block) {
    block.el.classList.add("running");
    status.textContent = `[0] running | ${block.command}`;

    await typeText(block.commandEl, block.command, 95);

    try {
      const result = await block.output();
      await typeText(block.outputEl, result, 320);
      block.el.classList.remove("running");
      block.el.classList.add("done");
      block.cursorEl.classList.add("idle");
      block.executed = true;
      status.textContent = `[0] done | ${block.command}`;
    } catch (error) {
      await typeText(block.outputEl, `[error] ${error.message}\n`, 300);
      block.el.classList.remove("running");
      block.el.classList.add("done");
      block.cursorEl.classList.add("idle");
      block.executed = true;
      status.textContent = `[1] error | ${block.command}`;
    }
  }

  function typeText(targetEl, text, cps) {
    return new Promise((resolve) => {
      let i = 0;
      const value = String(text || "");
      const started = performance.now();
      let lastTick = started;

      function step(now) {
        const elapsed = (now - lastTick) / 1000;
        lastTick = now;

        const chunk = Math.max(1, Math.floor(cps * elapsed));
        const next = Math.min(value.length, i + chunk);
        if (next > i) {
          targetEl.textContent += value.slice(i, next);
          i = next;
        }

        if (i < value.length) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(step);
    });
  }
})();
