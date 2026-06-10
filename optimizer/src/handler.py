"""疎通確認用の仮ハンドラ。最適化処理の実装時に置き換える。"""


def lambda_handler(event, context):
    return {
        "status": "ok",
        "message": "optimizer placeholder",
        "received": event,
    }
