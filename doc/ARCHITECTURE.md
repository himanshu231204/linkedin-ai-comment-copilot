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
        ROUTER["ChatLiteLLMRouter<br/>Automatic Fallback"]
    end

    subgraph "AI Providers"
        GROQ["Groq Cloud<br/>Llama 3.3 70B (Primary)"]
        GEM["Google AI<br/>Gemini 2.5 Flash (Fallback)"]
        LS["LangSmith<br/>Observability"]
    end

    EXT <-->|"HTTPS API<br/>(Render Cloud)"| API
    API --> LG
    LG --> ROUTER
    ROUTER --> GROQ
    ROUTER --> GEM
    LG --> LS

    style EXT fill:#FFC107,color:#000
    style API fill:#009688,color:#fff
    style LG fill:#FF6B35,color:#fff
    style ROUTER fill:#9C27B0,color:#fff
    style GROQ fill:#F55036,color:#fff
    style GEM fill:#4285F4,color:#fff
    style LS fill:#6C47FF,color:#fff
```

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Chrome Extension"
        CTX["Content Script<br/>(LinkedIn page injection)"]
        BG["Background Service Worker<br/>(API orchestration)"]
    end

    subgraph "FastAPI Backend (Render)"
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

    subgraph "ChatLiteLLMRouter (per agent)"
        R1["Analyzer Router<br/>Primary: Groq<br/>Fallback: Gemini"]
        R2["Planner Router<br/>Primary: Groq<br/>Fallback: Gemini"]
        R3["Writer Router<br/>Primary: Groq<br/>Fallback: Gemini"]
        R4["Reviewer Router<br/>Primary: Groq<br/>Fallback: Gemini"]
    end

    subgraph "LLM Providers"
        GROQLLAMA["Groq Llama 3.3 70B"]
        GEMINI["Google Gemini 2.5 Flash"]
    end

    CTX -->|"chrome.runtime<br/>sendMessage"| BG
    BG -->|"POST /generate-comment"| ROUTE
    ROUTE --> CORS
    CORS --> GRAPH
    LS --> GRAPH
    GRAPH --> AN
    AN --> R1
    R1 --> PL
    PL --> R2
    R2 --> WR
    WR --> R3
    R3 --> RV
    RV -->|"reject"| WR
    RV -->|"approve"| BG
    R1 --> GROQLLAMA
    R1 -.->|"fallback"| GEMINI
    R2 --> GROQLLAMA
    R2 -.->|"fallback"| GEMINI
    R3 --> GROQLLAMA
    R3 -.->|"fallback"| GEMINI
    R4 --> GROQLLAMA
    R4 -.->|"fallback"| GEMINI
```

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

    class ChatLiteLLMRouter {
        +model_list: List[ModelConfig]
        +fallbacks: List[Dict]
        +num_retries: int
        +timeout: int
        +ainvoke(messages)
    }

    class CostTracker {
        +get_llm_cost(response, model)
        +LLMCostResult
        +_resolve_pricing()
    }

    class AnalyzerAgent {
        +create_analyzer_agent_with_router()
        +classify(post)
        +Output: post_type, category, sentiment
    }

    class PlannerAgent {
        +create_planner_agent_with_router()
        +plan(type, category, tone)
        +Output: strategy
    }

    class WriterAgent {
        +create_writer_agent_with_router()
        +write(content, tone, strategy)
        +Output: comment
    }

    class ReviewerAgent {
        +create_reviewer_agent_with_router()
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
    AnalyzerAgent --> ChatLiteLLMRouter
    PlannerAgent --> ChatLiteLLMRouter
    WriterAgent --> ChatLiteLLMRouter
    ReviewerAgent --> ChatLiteLLMRouter
```

---

## Data Flow

### Request Lifecycle

```mermaid
sequenceDiagram
    participant User as LinkedIn User
    participant Ext as Chrome Extension
    participant API as FastAPI (Render)
    participant LG as LangGraph
    participant R as ChatLiteLLMRouter
    participant Groq as Groq (Primary)
    participant Gemini as Gemini (Fallback)

    User->>Ext: Click "Generate AI Comment"
    Ext->>Ext: Extract post content
    Ext->>API: POST /generate-comment<br/>{post_content, tone}

    API->>LG: ainvoke(CommentState)

    LG->>R: Analyzer Router
    R->>Groq: Try primary
    Groq-->>R: classification
    R-->>LG: {post_type, category, sentiment}

    LG->>R: Planner Router
    R->>Groq: Try primary
    Groq-->>R: strategy
    R-->>LG: {strategy}

    LG->>R: Writer Router
    R->>Groq: Try primary
    Groq-->>R: comment
    R-->>LG: generated_comment

    LG->>R: Reviewer Router
    R->>Groq: Try primary
    Groq-->>R: score/approved
    R-->>LG: {approved: true, score: 92}

    LG-->>API: final_comment
    API-->>Ext: {comment: "..."}
    Ext-->>Ext: Store in chrome.storage + broadcast
    Ext-->>User: Show Comment Card<br/>(Copy/Insert/Dismiss)
```

### Fallback Scenario

```mermaid
sequenceDiagram
    participant LG as LangGraph
    participant R as ChatLiteLLMRouter
    participant Groq as Groq (Primary)
    participant Gemini as Gemini (Fallback)

    LG->>R: Writer Router
    R->>Groq: Try primary
    Groq-->>R: 503 Service Unavailable
    R->>R: Retry (1/2)
    R->>Groq: Try primary again
    Groq-->>R: 503 Service Unavailable
    R->>Gemini: Fallback
    Gemini-->>R: comment
    R-->>LG: generated_comment (from Gemini)
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
    style B fill:#F55036,color:#fff
    style C fill:#F55036,color:#fff
    style D fill:#F55036,color:#fff
    style E fill:#F55036,color:#fff
    style F fill:#057642,color:#fff
```

---

## Backend Architecture

### Module Structure

```mermaid
graph TD
    MAIN["main.py<br/>FastAPI App + LiteLLM env vars"]
    GRAPH["comment_graph.py<br/>LangGraph Workflow"]
    LLM["llm.py<br/>LLM Config + Router + Cost Tracking"]
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

    subgraph "Backend API (Render)"
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

---

## Network Topology

```mermaid
graph TB
    subgraph "User's Machine"
        BROWSER["Chrome Browser"]
        EXT["Extension<br/>(content + background)"]
    end

    subgraph "Render Cloud"
        SERVER["FastAPI Server<br/>linkedin-ai-comment-copilot-1.onrender.com"]
    end

    subgraph "Cloud Providers"
        GROQ_CLOUD["Groq Cloud<br/>api.groq.com<br/>(Primary LLM)"]
        GOOGLE["Google AI<br/>generativelanguage.googleapis.com<br/>(Fallback LLM)"]
        LS_CLOUD["LangSmith<br/>api.smith.langchain.com"]
    end

    BROWSER --> EXT
    EXT <-->|"HTTPS (cloud)"| SERVER
    SERVER -->|"HTTPS"| GROQ_CLOUD
    SERVER -->|"HTTPS"| GOOGLE
    SERVER -->|"HTTPS"| LS_CLOUD
```

### Deployment Details

| Component | Location | URL |
|-----------|----------|-----|
| Chrome Extension | User's browser | `chrome://extensions/` (loaded unpacked) |
| FastAPI Backend | Render Web Service | `https://linkedin-ai-comment-copilot-1.onrender.com` |
| Groq API | Cloud | `https://api.groq.com/openai/v1` |
| Google AI API | Cloud | `https://generativelanguage.googleapis.com` |
| LangSmith | Cloud | `https://api.smith.langchain.com` |

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Python | 3.11+ | Backend language |
| **API** | FastAPI | 0.100+ | Async HTTP framework |
| **Server** | Uvicorn | Latest | ASGI server |
| **AI Framework** | LangGraph | Latest | Multi-agent orchestration |
| **LLM SDK** | LangChain + LiteLLM | Latest | LLM abstraction + routing |
| **LLM Router** | ChatLiteLLMRouter | Latest | Automatic model fallback |
| **Validation** | Pydantic | 2.x | Data schemas |
| **Observability** | LangSmith | Latest | Tracing & monitoring |
| **LLM (Primary)** | Llama 3.3 70B | - | Meta open-source models via Groq |
| **LLM (Fallback)** | Gemini 2.5 Flash | - | Google AI models |
| **Inference** | Groq Cloud | - | Ultra-fast LLM inference |
| **Deployment** | Render | - | Cloud hosting |
| **Extension** | Chrome MV3 | - | Browser extension standard |
| **Frontend** | Vanilla JS | ES2022 | Content script + background worker |

---

*Last updated: June 2026*
