"""
Test script to verify all LLM models are working correctly.
Run from the project root:
    python -m backend.test_models
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from langchain_core.messages import HumanMessage, SystemMessage
from backend.models.llm import (
    create_llm,
    get_analyzer_llm_config,
    get_planner_llm_config,
    get_writer_llm_config,
    get_reviewer_llm_config,
)


DIVIDER = "=" * 60


async def test_model(name: str, config_fn) -> bool:
    """Test a single model by sending a prompt and printing the response."""
    print(f"\n{DIVIDER}")
    print(f"  Testing: {name}")
    print(f"{DIVIDER}")

    try:
        config = config_fn()
        print(f"  Model:   {config.model_name}")
        print(f"  Temp:    {config.temperature}")
        print(f"  Max Tok: {config.max_tokens}")
        print()

        llm = create_llm(config)

        messages = [
            SystemMessage(content="You are a helpful assistant. Reply in one short sentence."),
            HumanMessage(content="What is the capital of France?"),
        ]

        print("  Sending request...")
        response = await llm.ainvoke(messages)

        print(f"  Response: {response.content}")
        print(f"  Status:   OK")
        return True

    except Exception as e:
        print(f"  Status:   FAILED")
        print(f"  Error:    {type(e).__name__}: {e}")
        return False


async def main():
    """Run tests for all four models."""
    print("\n" + DIVIDER)
    print("  LinkedIn AI Comment Copilot - Model Test")
    print(DIVIDER)

    models = [
        ("Analyzer  (Gemini 2.5 Flash)", get_analyzer_llm_config),
        ("Planner   (Gemini 2.5 Flash)", get_planner_llm_config),
        ("Writer    (Llama 3.3 70B - Groq)", get_writer_llm_config),
        ("Reviewer  (Llama 3.3 70B - Groq)", get_reviewer_llm_config),
    ]

    results = {}
    for name, config_fn in models:
        results[name] = await test_model(name, config_fn)

    # Summary
    print(f"\n{DIVIDER}")
    print("  Summary")
    print(DIVIDER)

    passed = 0
    failed = 0
    for name, success in results.items():
        status = "PASS" if success else "FAIL"
        icon = "+" if success else "X"
        print(f"  [{icon}] {name}: {status}")
        if success:
            passed += 1
        else:
            failed += 1

    print(f"\n  Total: {passed} passed, {failed} failed")
    print(DIVIDER + "\n")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
