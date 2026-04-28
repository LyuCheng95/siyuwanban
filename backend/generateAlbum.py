"""
为单个角色生成多张封面图（album）
用法：python generateAlbum.py [角色名] [张数]
示例：python generateAlbum.py 林晓雅 3

ComfyUI 需要在本地 8188 端口运行
图片生成完后会自动上传到服务器并更新数据库
"""

import sys
import os
import json
import time
import random
import shutil
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

# ── 配置 ──────────────────────────────────────────────────────────────────────
COMFYUI_URL = "http://127.0.0.1:8188"
SAVE_DIR    = Path("D:/SD/siyuwanban/portraits")
SERVER_IP   = "168.144.108.9"
SERVER_IMG_DIR = "/var/www/siyuwanban/images"
PUBLIC_BASE = "https://siyuwanban.shangzongcai.com"

# Backend API（服务器上的，用于更新数据库）
# 如果你想直接通过 API 更新 DB，需要一个 system token
# 这里我们改为 SSH 直接跑 psql 命令
DB_NAME = "soullink"
DB_USER = "postgres"

# ── 超高质量正面 prompt 前缀 ────────────────────────────────────────────────────
QUALITY_PREFIX = ", ".join([
    "(photorealistic:1.4)", "(hyperrealistic:1.3)", "RAW photo", "8k uhd", "masterpiece",
    "(perfect face:1.5)", "(beautiful face:1.5)", "(stunning beauty:1.4)",
    "(perfect symmetrical face:1.3)", "(flawless skin:1.3)",
    "(gorgeous:1.3)", "(detailed eyes:1.3)", "(perfect eyes:1.3)",
    "(supermodel:1.2)", "(editorial lighting:1.2)",
    "(explicit:1.4)", "(nsfw:1.4)",
])

NEGATIVE = ", ".join([
    "(worst quality:1.6)", "(low quality:1.6)", "(normal quality:1.4)",
    "bad anatomy", "bad face", "ugly face", "asymmetrical face", "deformed face",
    "extra limbs", "deformed hands", "extra fingers", "missing fingers",
    "blurry", "watermark", "text", "logo", "signature",
    "censored bar", "mosaic", "pixelated genitals", "covered genitals", "underwear covering",
    "cross-eye", "lazy eye", "bad eyes",
])

# ── 每个角色的多套场景 ──────────────────────────────────────────────────────────
ALBUM_PROMPTS = {
    "林晓雅": [
        "1girl, 28 years old, chinese woman, lawyer, long black hair updo, sharp eyes, dark red lips, perfect oval face, office suit jacket sliding off shoulders, (bare breasts:1.6), (erect nipples:1.5), pencil skirt pushed up to waist, (pussy visible:1.5), legs slightly spread, sitting on mahogany desk, glass city lights behind, dramatic rim lighting, luxury office, 4k detail",
        "1girl, 28 years old, chinese woman, long black hair down loose, sharp eyes, dark red lips, perfect oval face, white unbuttoned shirt hanging off one shoulder, (bare breasts:1.6), (nipples:1.5), no underwear, (pussy peeking:1.4), leaning against floor-to-ceiling window, city skyline at night, warm amber glow, wine glass in hand, confident smirk, cinematic lighting",
        "1girl, 28 years old, chinese woman, long black hair tied loosely, sharp eyes, perfect face, wearing only unbuttoned white shirt, (large bare breasts fully exposed:1.6), (erect nipples:1.5), (shaved pussy fully visible:1.6), (spread legs:1.4), sitting wide on leather chair, conference table, meeting room, documents scattered, tie loosened around neck, dominant expression, dramatic side lighting",
    ],
    "椎名老师": [
        "1girl, 24 years old, japanese woman, black framed glasses, dark hair in bun, perfect cute face, white shirt wide open, (bare breasts:1.6), (erect nipples:1.5), short pleated skirt lifted, (panties pulled down to knees:1.5), (pussy exposed:1.6), sitting on classroom desk legs spread, piece of chalk on desk, afternoon light, empty classroom, flushed cheeks, embarrassed expression",
        "1girl, 24 years old, japanese teacher, black framed glasses, dark hair loose down, perfect cute face, only wearing open white shirt, (bare breasts:1.6), (nipples:1.5), leaning over desk showing cleavage, (pussy visible:1.5), skirt bunched up, blackboard behind with equations, soft focus background, warm classroom light, biting lip",
        "1girl, 24 years old, japanese woman, glasses removed, dark hair, beautiful face, completely nude, (large bare breasts:1.6), (erect nipples:1.5), (pussy fully exposed:1.6), sitting in teacher chair legs apart, classroom setting, golden evening light, expression mix of shame and arousal, textbook open on desk",
    ],
    "狐九": [
        "1girl, fox girl, nine fluffy white tails fanned out, fox ears, silver white long flowing hair, glowing amber eyes, beautiful ethereal face, translucent silk hanfu falling open, (bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.5), sitting on ancient stone altar, full moon behind, misty forest, ethereal purple glow, magical particles floating",
        "1girl, fox girl, nine white tails, fox ears, silver white hair windswept, glowing amber eyes, perfect ethereal face, completely nude, (full breasts:1.6), (erect nipples:1.5), (pussy fully visible:1.6), lying in moonlit clearing, flower petals around, ancient tree roots, supernatural glow from skin, one tail curled between legs suggestively",
        "1girl, fox girl, fox ears, silver hair, amber slit eyes, gorgeous face, wearing only white fox fur wrap barely covering, (side breast:1.5), (nipples peeking:1.4), (pussy visible from below:1.5), standing in shrine gateway at dusk, dramatic red torii gate, atmospheric fog, supernatural beauty",
    ],
    "晓彤": [
        "1girl, 22 years old, chinese woman, athletic toned body, ponytail, beautiful face, gym crop top pulled up, (bare athletic breasts:1.6), (nipples:1.5), gym shorts pulled down to thighs, (toned abs:1.2), (pussy exposed:1.5), leaning against gym locker, gym locker room, fluorescent lighting, sweaty glistening skin, confident smirk",
        "1girl, 22 years old, chinese woman, athletic build, hair down, beautiful face, sports bra pushed up, (bare breasts:1.6), (erect nipples:1.5), sports shorts completely removed, (pussy visible:1.6), lying on gym mat doing exercise pose, modern gym background, afternoon light, toned body detail",
        "1girl, 22 years old, chinese woman, athletic body, ponytail, cute face, wearing only unbuttoned gym jacket, (nude under:1.5), (full bare breasts:1.6), (nipples:1.5), (pussy exposed:1.5), sitting on front desk, gym reception background, end of day lighting, playful expression",
    ],
}


def http_get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())


def http_post(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def build_workflow(prompt, seed):
    full_prompt = f"{QUALITY_PREFIX}, {prompt}"
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "realvisxlV50_v50LightningBakedvae.safetensors"}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": full_prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["4", 1]}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 768, "height": 1024, "batch_size": 1}},
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
                "seed": seed, "steps": 30, "cfg": 6.5,
                "sampler_name": "dpm_2_ancestral", "scheduler": "karras", "denoise": 1.0,
            },
        },
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": "album"}},
    }


def queue_prompt(workflow):
    result = http_post(f"{COMFYUI_URL}/prompt", {"prompt": workflow})
    return result["prompt_id"]


def wait_for_image(prompt_id):
    deadline = time.time() + 300
    while time.time() < deadline:
        time.sleep(3)
        try:
            history = http_get(f"{COMFYUI_URL}/history/{prompt_id}")
        except Exception:
            continue
        entry = history.get(prompt_id)
        if not entry or not entry.get("outputs"):
            continue
        for node_out in entry["outputs"].values():
            imgs = node_out.get("images", [])
            if imgs:
                return imgs[0]["filename"]
    raise TimeoutError("Timeout waiting for image")


def download_and_save(filename, char_name, idx):
    url = f"{COMFYUI_URL}/view?filename={filename}&type=output"
    safe_name = "".join(c if (c.isalnum() or '一' <= c <= '鿿') else '_' for c in char_name)
    save_name = f"album_{safe_name}_{idx}_{int(time.time())}.png"
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    save_path = SAVE_DIR / save_name

    with urllib.request.urlopen(url) as resp:
        with open(save_path, "wb") as f:
            shutil.copyfileobj(resp, f)

    public_url = f"{PUBLIC_BASE}/images/{save_name}"
    return str(save_path), save_name, public_url


def scp_file(local_path, filename):
    """SCP 单个文件到服务器"""
    remote = f"root@{SERVER_IP}:{SERVER_IMG_DIR}/{filename}"
    result = subprocess.run(["scp", local_path, remote], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"    ⚠️  SCP failed: {result.stderr}")
        return False
    return True


def update_db_via_ssh(char_name, urls):
    """通过 SSH + psql 更新数据库"""
    portrait_url = urls[0]
    portrait_images_json = json.dumps(urls).replace("'", "''")

    # Find system user id (telegramId=1) then find character
    sql = f"""
DO $$
DECLARE
  v_creator_id TEXT;
  v_char_id TEXT;
BEGIN
  SELECT id INTO v_creator_id FROM "User" WHERE "telegramId" = 1;
  SELECT id INTO v_char_id FROM "Character" WHERE name = '{char_name}' AND "creatorId" = v_creator_id;
  IF v_char_id IS NOT NULL THEN
    UPDATE "Character"
    SET "portraitUrl" = '{portrait_url}',
        "portraitImages" = '{portrait_images_json}'::jsonb
    WHERE id = v_char_id;
    RAISE NOTICE 'Updated character % with % images', v_char_id, array_length(ARRAY[{",".join(["1"]*len(urls))}], 1);
  ELSE
    RAISE EXCEPTION 'Character not found: {char_name}';
  END IF;
END $$;
"""
    cmd = f'psql -U {DB_USER} -d {DB_NAME} -c "{sql.strip()}"'
    result = subprocess.run(
        ["ssh", f"root@{SERVER_IP}", cmd],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"    ⚠️  DB update failed: {result.stderr}")
        return False
    print(f"    ✅ 数据库已更新")
    return True


def main():
    char_name = sys.argv[1] if len(sys.argv) > 1 else "林晓雅"
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    prompts = ALBUM_PROMPTS.get(char_name)
    if not prompts:
        print(f"❌ 没有找到 \"{char_name}\" 的 prompt，可用角色:", "、".join(ALBUM_PROMPTS.keys()))
        sys.exit(1)

    # Test ComfyUI connection
    try:
        http_get(f"{COMFYUI_URL}/system_stats")
        print(f"✅ ComfyUI 连接正常")
    except Exception as e:
        print(f"❌ 无法连接到 ComfyUI ({COMFYUI_URL}): {e}")
        print("请确认 ComfyUI 正在运行（8188 端口）")
        sys.exit(1)

    print(f"\n🎨 开始为 {char_name} 生成 {count} 张封面图...\n")
    local_files = []
    public_urls = []

    for i in range(min(count, len(prompts))):
        prompt = prompts[i]
        print(f"  [{i+1}/{count}] 生成中...")
        print(f"  Prompt: {prompt[:80]}...")

        try:
            seed = random.randint(0, 2**32 - 1)
            workflow = build_workflow(prompt, seed)
            prompt_id = queue_prompt(workflow)
            filename = wait_for_image(prompt_id)
            local_path, save_name, public_url = download_and_save(filename, char_name, i + 1)
            local_files.append((local_path, save_name))
            public_urls.append(public_url)
            print(f"  ✅ 图片 {i+1} 保存到: {local_path}\n")
        except Exception as e:
            print(f"  ❌ 图片 {i+1} 失败: {e}\n")

        if i < count - 1:
            time.sleep(2)

    if not public_urls:
        print("所有图片生成失败")
        sys.exit(1)

    print(f"\n📤 上传 {len(public_urls)} 张图片到服务器...")
    for local_path, save_name in local_files:
        ok = scp_file(local_path, save_name)
        print(f"  {'✅' if ok else '❌'} {save_name}")

    print(f"\n💾 更新数据库...")
    update_db_via_ssh(char_name, public_urls)

    print(f"\n✨ 完成！{char_name} 共生成 {len(public_urls)} 张封面图")
    print("图片 URLs:")
    for i, u in enumerate(public_urls):
        print(f"  {i+1}. {u}")


if __name__ == "__main__":
    main()
