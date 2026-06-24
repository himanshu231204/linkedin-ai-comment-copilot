# Architecture

**LinkedIn AI Comment Copilot** — System architecture, component design, and data flow documentation.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Diagram](#component-diagram)
4. [Data Flow](#data-flow)
5. [Backend Architecture](#backend-architecture)
6. [Chrome Extension Architecture](#chrome-extension-architecture)
7. [Network Topology](#network-topology)
8. [Technology Stack](#technology-stack)

---

## System Overview

The LinkedIn AI Comment Copilot is a full-stack, real-time AI system consisting of two main components:

```mermaid
graph LR
    subgraph "Client Side"
        EXT["Chrome Extension<br/>Manifest V3"]
    end

    subgraph "Server Side"
        API["FastAPI Backend<br/>Python 3.11+"]
        LG["LangGraph<br/>Multi-Agent Workflow"]
    end

    subgraph "AI Providers"
        GEM["Google AI<br/>Gemini 2.5 Flash"]
        GROQ["Groq Cloud<br/>Llama 3.3 70B"]
        LS["LangSmith<br/>Observability"]
    end

    EXT <-->|"HTTP API<br/>(localhost:8000)"| API
    API --> LG
    LG --> GEM
    LG --> GROQ
    LG --> LS

    style EXT fill:#FFC107,color:#000
    style API fill:#009688,color:#fff
    style LG fill:#FF6B35,color:#fff
    style GEM fill:#4285F4,color:#fff
    style GROQ fill:#F55036,color:#fff
    style LS fill:#6C47FF,color:#fff
```
<div align="center">
  <img src="../assets/System Overview.png" alt="System Overview" />
</div>
---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Chrome Extension"
        CTX["Content Script<br/>(LinkedIn page injection)"]
        BG["Background Service Worker<br/>(API orchestration)"]
    end

    subgraph "FastAPI Backend"
        ROUTE["API Routes<br/>/generate-comment<br/>/test-cost<br/>/health"]
        CORS["CORS Middleware"]
        LS["LangSmith Config"]
    end

    subgraph "LangGraph Pipeline"
        GRAPH["StateGraph<br/>CommentState"]
        AN["Analyzer Node"]
        PL["Planner Node"]
        WR["Writer Node"]
        RV["Reviewer Node"]
    end

    subgraph "LLM Providers"
        GEMINI["Google Gemini 2.5 Flash"]
        GROQLLAMA["Groq Llama 3.3 70B"]
    end

    CTX -->|"chrome.runtime<br/>sendMessage"| BG
    BG -->|"POST /generate-comment"| ROUTE
    ROUTE --> CORS
    CORS --> GRAPH
    LS --> GRAPH
    GRAPH --> AN
    AN --> PL
    PL --> WR
    WR --> RV
    RV -->|"reject"| WR
    RV -->|"approve"| BG
    AN --> GEMINI
    PL --> GEMINI
    WR --> GROQLLAMA
    RV --> GROQLLAMA
```
<div align="center">
  <img src="../assets/High-Level Architecture.png" alt="High-Level Architecture" />
</div>
---

## Component Diagram

```mermaid
classDiagram
    class ChromeExtension {
        +ContentScript: injectButton()
        +ContentScript: showCommentNotification()
        +Background: callAPI()
    }

    class FastAPI {
        +POST /generate-comment()
        +POST /test-cost()
        +GET /health()
        +configure_langsmith()
    }

    class LangGraph {
        +CommentState state
        +analyzer_node()
        +planner_node()
        +writer_node()
        +reviewer_node()
        +should_regenerate()
    }

    class CostTracker {
        +get_llm_cost(response, model)
        +LLMCallbackHandler
        +LLMCostResult
        +_resolve_pricing()
    }

    class AnalyzerAgent {
        +Gemini 2.5 Flash
        +classify(post)
        +Output: post_type, category, sentiment
    }

    class PlannerAgent {
        +Gemini 2.5 Flash
        +plan(type, category, tone)
        +Output: strategy
    }

    class WriterAgent {
        +Llama 3.3 70B
        +write(content, tone, strategy)
        +Output: comment
    }

    class ReviewerAgent {
        +Llama 3.3 70B
        +review(content, comment, tone)
        +Output: approved, score
    }

    ChromeExtension --> FastAPI : HTTP
    FastAPI --> LangGraph : ainvoke()
    FastAPI --> CostTracker : get_llm_cost()
    LangGraph --> AnalyzerAgent
    LangGraph --> PlannerAgent
    LangGraph --> WriterAgent
    LangGraph --> ReviewerAgent
```

<div align="center">
  <img src="../assets/component_diagram.png" alt="component_diagram" />
</div>
---

## Data Flow

### Request Lifecycle

```mermaid
sequenceDiagram
    participant User as LinkedIn User
    participant Ext as Chrome Extension
    participant API as FastAPI
    participant LG as LangGraph
    participant A as Analyzer
    participant P as Planner
    participant W as Writer
    participant R as Reviewer

    User->>Ext: Click "Generate AI Comment"
    Ext->>Ext: Extract post content
    Ext->>API: POST /generate-comment<br/>{post_content, tone}

    API->>LG: ainvoke(CommentState)

    LG->>A: analyze_post(content, config)
    A-->>LG: {post_type, category, sentiment}

    LG->>P: plan_strategy(type, category, tone, config)
    P-->>LG: {strategy}

    LG->>W: write_comment(content, tone, strategy, config)
    W-->>LG: generated_comment

    LG->>R: review_comment(content, comment, tone, config)
    R-->>LG: {approved: true, score: 92}

    LG-->>API: final_comment
    API-->>Ext: {comment: "..."}
    Ext-->>Ext: Store in chrome.storage + broadcast
    Ext-->>User: Show Comment Card<br/>(Copy/Insert/Dismiss)
```

### Data Transformations

```mermaid
graph LR
    A["Raw Post Content<br/>(string)"] -->|Analyzer| B["Classification<br/>post_type, category, sentiment"]
    B -->|Planner| C["Strategy<br/>comment approach"]
    C -->|Writer| D["Generated Comment<br/>(string)"]
    D -->|Reviewer| E["Quality Score<br/>approved, score (0-100)"]

    E -->|"score >= 80"| F["Final Comment"]
    E -->|"score < 80"| D

    style A fill:#E3F2FD
    style B fill:#4285F4,color:#fff
    style C fill:#4285F4,color:#fff
    style D fill:#F55036,color:#fff
    style E fill:#F55036,color:#fff
    style F fill:#057642,color:#fff
```

---

## Backend Architecture

### Module Structure

```mermaid
graph TD
    MAIN["main.py<br/>FastAPI App"]
    GRAPH["comment_graph.py<br/>LangGraph Workflow"]
    LLM["llm.py<br/>LLM Configuration + Cost Tracking"]
    ROUTER["model_router.py<br/>Model Utilities"]

    AN["analyzer.py"]
    PL["planner.py"]
    WR["writer.py"]
    RV["reviewer.py"]

    AP["analyzer_prompt.py"]
    PP["planner_prompt.py"]
    WP["writer_prompt.py"]
    RP["reviewer_prompt.py"]

    REQ["request.py"]
    RES["response.py"]

    MAIN --> GRAPH
    MAIN --> REQ
    MAIN --> RES
    GRAPH --> AN
    GRAPH --> PL
    GRAPH --> WR
    GRAPH --> RV
    GRAPH --> LLM
    AN --> LLM
    AN --> AP
    PL --> LLM
    PL --> PP
    WR --> LLM
    WR --> WP
    RV --> LLM
    RV --> RP
    LLM --> ROUTER
```
<div align="center">
  <img src="../assets/Module Structure.png" alt="Module Structure" />
</div>
---
### Error Handling Flow

```mermaid
graph TD
    REQ[Request] --> TRY{Try}
    TRY -->|Success| RES[Response]
    TRY -->|HTTPException| HTTP[HTTP Error]
    TRY -->|LLM Error| RETRY[Retry via Graph]
    TRY -->|Parse Error| FALLBACK[Fallback Response]

    RETRY --> REGEN[Regenerate Comment]
    REGEN --> REVIEW{Reviewer}
    REVIEW -->|"pass"| RES
    REVIEW -->|"fail"| RETRY

    style RES fill:#057642,color:#fff
    style HTTP fill:#F44336,color:#fff
```
<div align="center">
  <img src="../assets/Error Handling Flow.png" alt="Error Handling Flow" />
</div>
---

## Chrome Extension Architecture

```mermaid
graph TD
    subgraph "Manifest V3"
        BG["background.js<br/>Service Worker"]
        CTX["content.js<br/>Content Script"]
    end

    subgraph "LinkedIn Page"
        POST["LinkedIn Post<br/>DOM Element"]
        BTN["AI Comment Button<br/>(injected)"]
        CARD["Comment Card<br/>(generated UI)"]
        INPUT["Comment Box<br/>(auto-fill)"]
    end

    subgraph "Backend API"
        GEN["/generate-comment"]
        HEALTH["/health"]
    end

    CTX -->|"MutationObserver<br/>detects new posts"| POST
    CTX -->|"Inject button"| BTN
    BTN -->|"Click"| CTX
    CTX -->|"chrome.runtime<br/>sendMessage"| BG
    BG -->|"fetch()"| GEN
    GEN -->|"Response"| BG
    BG -->|"chrome.storage<br/>+ broadcast"| CTX
    CTX -->|"showCommentNotification"| CARD
    CARD -->|"Insert Comment"| INPUT
```
<div align="center">
  <img src="../assets/Chrome Extension Architecture.png" alt="Chrome Extension Architecture" />
</div>
---

## Network Topology

```mermaid
graph TB
    subgraph "Local Machine"
        BROWSER["Chrome Browser"]
        EXT["Extension<br/>(content + background)"]
        SERVER["FastAPI Server<br/>(localhost:8000)"]
    end

    subgraph "Cloud"
        GOOGLE["Google AI<br/>generativelanguage.googleapis.com"]
        GROQ_CLOUD["Groq Cloud<br/>api.groq.com"]
        LS_CLOUD["LangSmith<br/>api.smith.langchain.com"]
    end

    BROWSER --> EXT
    EXT <-->|"HTTP (local)"| SERVER
    SERVER -->|"HTTPS"| GOOGLE
    SERVER -->|"HTTPS"| GROQ_CLOUD
    SERVER -->|"HTTPS"| LS_CLOUD
```
<div align="center">
  <img src="../assets/Network Topology.png" alt="Network Topology" />
</div>
---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Python | 3.11+ | Backend language |
| **API** | FastAPI | 0.100+ | Async HTTP framework |
| **Server** | Uvicorn | Latest | ASGI server |
| **AI Framework** | LangGraph | Latest | Multi-agent orchestration |
| **LLM SDK** | LangChain + LiteLLM | Latest | LLM abstraction |
| **Validation** | Pydantic | 2.x | Data schemas |
| **Observability** | LangSmith | Latest | Tracing & monitoring |
| **LLM (Analysis)** | Gemini 2.5 Flash | - | Google AI models |
| **LLM (Generation)** | Llama 3.3 70B | - | Meta open-source models |
| **Inference** | Groq Cloud | - | Ultra-fast LLM inference |
| **Extension** | Chrome MV3 | - | Browser extension standard |
| **Frontend** | Vanilla JS | ES2022 | Content script + background worker |

---

*Last updated: June 2026*
