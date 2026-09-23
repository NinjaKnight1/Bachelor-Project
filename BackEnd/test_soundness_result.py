import unittest

from soundness_result import summarize_soundness


class SoundnessResultTests(unittest.TestCase):
    def test_verdicts(self):
        cases = [
            ("Example is data-aware sound", True),
            ("Example is not data-aware sound", False),
            ("Ada gives up.", None),
            ("", None),
            (
                "Example is data-aware sound\n"
                "Example is not data-aware sound",
                None,
            ),
        ]

        for output, expected in cases:
            with self.subTest(output=output):
                result = summarize_soundness({
                    "stdout": output,
                    "stderr": "",
                    "return_code": 0,
                    "exception": None,
                })
                self.assertIs(result["is_sound"], expected)

    def test_preserves_explanation(self):
        output = (
            "deadlock in Gateway_1 with valuation Num = 0\n"
            "Example is not data-aware sound"
        )

        result = summarize_soundness({
            "stdout": output,
            "stderr": "Additional explanation",
            "return_code": 0,
            "exception": None,
        })

        self.assertIs(result["is_sound"], False)
        self.assertEqual(
            result["explanation"],
            output + "\nAdditional explanation",
        )

    def test_failure_overrides_printed_verdict(self):
        for failure in (
            {"return_code": 1, "exception": None},
            {"return_code": 0, "exception": "Solver failed"},
        ):
            with self.subTest(failure=failure):
                result = summarize_soundness({
                    "stdout": "Example is data-aware sound",
                    "stderr": "",
                    **failure,
                })
                self.assertIsNone(result["is_sound"])


if __name__ == "__main__":
    unittest.main()
