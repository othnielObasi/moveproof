"""Integrity checks for the serverless source/artifact transport."""
import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile


def load(name):
    path = Path(__file__).resolve().parents[1] / "deploy" / "nebius" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bootstrap = load("benchmark_bootstrap")
collector = load("collect_artifacts")


class ArtifactsTest(unittest.TestCase):
    def test_reports_round_trip_without_secrets(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "source"
            source.mkdir()
            for name in collector.NAMES:
                (source / name).write_bytes((name + "\n").encode())
            (source / ".env").write_text("must not be exported", encoding="utf-8")
            logs = io.StringIO()
            with contextlib.redirect_stdout(logs):
                bootstrap.emit_artifacts(source)
            output = Path(temp) / "recovered"
            collector.recover(logs.getvalue(), output)
            self.assertEqual({p.name for p in output.iterdir()}, collector.NAMES)
            for name in collector.NAMES:
                self.assertEqual((output / name).read_bytes(), (source / name).read_bytes())
            with self.assertRaisesRegex(ValueError, "complete artifact"):
                collector.recover(logs.getvalue().replace("MOVEPROOF_ARTIFACT_END", ""), output)
            with self.assertRaisesRegex(ValueError, "checksum"):
                collector.recover(logs.getvalue().replace('"sha256": "', '"sha256": "0'), output)

    def test_rejects_source_path_traversal(self):
        payload = io.BytesIO()
        with zipfile.ZipFile(payload, "w") as archive:
            archive.writestr("../escaped.txt", "bad")
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                bootstrap.extract_source(payload.getvalue(), Path(temp))

    def test_accepts_expected_source_tree(self):
        payload = io.BytesIO()
        with zipfile.ZipFile(payload, "w") as archive:
            archive.writestr("moveproof-sha/backend/bench/__init__.py", "")
        with tempfile.TemporaryDirectory() as temp:
            source = bootstrap.extract_source(payload.getvalue(), Path(temp))
            self.assertTrue((source / "backend" / "bench").is_dir())


if __name__ == "__main__":
    unittest.main()
