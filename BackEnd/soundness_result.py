def summarize_soundness(result: dict) -> dict:
    output = "\n".join(
        part for part in (
            result.get("stdout", "").strip(),
            result.get("stderr", "").strip(),
        )
        if part
    )

    exception = result.get("exception")
    return_code = result.get("return_code", 0)

    if exception or return_code != 0:
        reason = exception or f"ADA exited with code {return_code}."
        return {
            "is_sound": None,
            "message": "The soundness check could not complete.",
            "explanation": "\n\n".join(
                part for part in (output, str(reason)) if part
            ),
        }

    lines = output.splitlines()
    sound = any(
        line.rstrip().endswith(" is data-aware sound")
        for line in lines
    )
    unsound = any(
        line.rstrip().endswith(" is not data-aware sound")
        for line in lines
    )

    if sound == unsound:
        return {
            "is_sound": None,
            "message": "ADA did not return a conclusive soundness result.",
            "explanation": output or "ADA returned no explanation.",
        }

    return {
        "is_sound": sound,
        "message": (
            "The model is sound."
            if sound
            else "The model is not sound."
        ),
        "explanation": output or "ADA returned no explanation.",
    }
