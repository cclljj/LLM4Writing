workspace "LLM4Writing C4 Model" "C4 model diagrams generated from docs/openspec + docs/SPEC.md" {

  model {
    student = person "Student" "Joins writing tasks, completes the 10-step learning workflow, and reviews personal history."
    teacher = person "Teacher" "Manages owned students/classes, controls course steps, and monitors learning progress."
    admin = person "Admin" "Performs global account/task management, diagnostics, and audit review."

    llm4w = softwareSystem "LLM4Writing" "AI-assisted writing instruction platform." {
      webapp = container "Web App + API" "Serves student/teacher/admin UI and Route Handlers." "Next.js 16, React 19, TypeScript" {
        ui = component "Role-based UI" "Student, teacher, and admin pages with workflow/status views." "Next.js App Router pages"
        authz = component "Auth & Authorization" "Server-signed cookie auth, role/ownership checks, sessionVersion validation." "Route middleware + auth module"
        workflowApi = component "Learning Workflow API" "Session/chat/step endpoints, gate control, artifact handling, SSE streams." "Next.js Route Handlers"
        teacherAdminApi = component "Teacher/Admin API" "Course control, monitor, user/task/group management, audit actions." "Next.js Route Handlers"
        diagnosticsApi = component "Diagnostics API" "Admin diagnostics, fallback metrics, migration trigger endpoints." "Next.js Route Handlers"
        llmOrchestrator = component "LLM Orchestrator" "Coordinates LLM prompts, retries, continuation, and fallback response generation." "Engine + llm-client"
        contextCompressor = component "LLM Context Compressor" "Builds layered historical summaries, removes duplicate/noisy lines, and preserves recent raw context." "llm-context"
        tokenBudgetGuard = component "LLM Token Budget Guard" "Applies centralized max_tokens floor (>= 50000) for chat and stream requests." "llm-client"
        step10Chunker = component "Step10 Chunked Report Generator" "Generates Step10 as outline + per-section content + optional final polish to reduce truncation." "engine"

        ui -> authz "Authenticates and authorizes"
        ui -> workflowApi "Calls student/session APIs"
        ui -> teacherAdminApi "Calls teacher/admin APIs"
        ui -> diagnosticsApi "Calls diagnostics endpoints (admin only)"
        workflowApi -> authz "Enforces participant and step constraints"
        teacherAdminApi -> authz "Enforces role and class boundaries"
        workflowApi -> llmOrchestrator "Requests AI output for workflow steps"
        llmOrchestrator -> contextCompressor "Builds compressed prompt context"
        llmOrchestrator -> tokenBudgetGuard "Sends provider requests with token floor"
        llmOrchestrator -> step10Chunker "Delegates long final report generation"
        diagnosticsApi -> teacherAdminApi "Reuses scoped management/query logic"
      }

      sessionStore = container "Session Store" "Sessions, messages, artifacts, reports, participants, LLM/learning events." "PostgreSQL + memory fallback"
      userStore = container "User Store" "User accounts, roles, bcrypt passwords, sessionVersion." "PostgreSQL + memory fallback"
      domainStore = container "Domain Store" "Users/essays/open classes/groups/course status domain state." "PostgreSQL singleton + file + memory fallback"
      auditStore = container "Audit Log Store" "Teacher/admin audit logs." "PostgreSQL + memory fallback"
      promptConfig = container "Prompt Config" "Read-only prompt/question configuration." "Filesystem JSON"
      runtimeState = container "Runtime State" "Rate limit buckets and session presence (ephemeral)." "Upstash Redis + memory fallback"

      webapp -> sessionStore "Reads/writes session and learning data"
      webapp -> userStore "Authenticates users and resolves roles"
      webapp -> domainStore "Reads/writes tasks, classes, groups, and status"
      webapp -> auditStore "Writes and queries audit events"
      webapp -> promptConfig "Loads prompt and question-bank configuration"
      webapp -> runtimeState "Checks rate limits and tracks presence"
    }

    remoteLLM = softwareSystem "Remote LLM Provider" "OpenAI-compatible chat completions endpoint (enabled by LLM_URL/LLM_KEY/LLM_MODEL)."

    student -> llm4w "Uses student workflow"
    teacher -> llm4w "Uses teaching and monitoring features"
    admin -> llm4w "Uses global administration and diagnostics"

    webapp -> remoteLLM "Generates step responses with compressed context and token floor when configured; otherwise fallback"
  }

  views {
    systemLandscape "landscape" {
      include *
      autolayout lr
      title "C1/C0 - System Landscape"
    }

    systemContext llm4w "context" {
      include *
      autolayout lr
      title "C1 - System Context"
    }

    container llm4w "containers" {
      include *
      autolayout lr
      title "C2 - Container Diagram"
    }

    component webapp "webapp-components" {
      include *
      autolayout lr
      title "C3 - Web App + API Components"
    }


    component webapp "webapp-student-flow" {
      include student
      include remoteLLM
      include ui
      include authz
      include workflowApi
      include llmOrchestrator
      include contextCompressor
      include tokenBudgetGuard
      include step10Chunker
      include sessionStore
      include userStore
      include domainStore
      include promptConfig
      include runtimeState
      autolayout lr
      title "C3 - Student Learning Flow Components"
    }

    component webapp "webapp-teacher-admin-flow" {
      include teacher
      include admin
      include ui
      include authz
      include teacherAdminApi
      include diagnosticsApi
      include llmOrchestrator
      include contextCompressor
      include tokenBudgetGuard
      include step10Chunker
      include sessionStore
      include userStore
      include domainStore
      include auditStore
      include runtimeState
      autolayout lr
      title "C3 - Teacher/Admin Management Components"
    }

    styles {
      element "Person" {
        shape person
        background "#0B7285"
        color "#ffffff"
      }

      element "Software System" {
        background "#1D4ED8"
        color "#ffffff"
      }

      element "Container" {
        background "#15803D"
        color "#ffffff"
      }

      element "Component" {
        background "#0F766E"
        color "#ffffff"
      }

      relationship "Relationship" {
        color "#334155"
        thickness 2
      }
    }
  }
}
