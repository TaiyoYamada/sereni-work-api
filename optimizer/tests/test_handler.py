from handler import lambda_handler


def test_lambda_handler_returns_ok():
    result = lambda_handler({"ping": True}, None)
    assert result["status"] == "ok"
    assert result["received"] == {"ping": True}
