# 本番(AWS Lambda)と同じベースイメージを開発でも使う
FROM public.ecr.aws/lambda/python:3.12

# OR-Tools 等のネイティブ依存でビルドツールが必要になったら、ここで dnf install する

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ${LAMBDA_TASK_ROOT}/

# src/handler.py の lambda_handler 関数をエントリポイントとする
CMD ["handler.lambda_handler"]
