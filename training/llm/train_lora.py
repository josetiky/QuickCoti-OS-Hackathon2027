"""Ajuste OFICIAL LoRA del asistente (correr en el servidor NVIDIA del concurso). Herramientas: PyTorch CUDA + PEFT.
Uso: python train_lora.py --data data --base Qwen/Qwen3-1.7B --epochs 2 --out out/quickcoti-lora
Guarda adaptador (safetensors) + REGISTRO_LLM.json (fecha, duración, GPU, pasos, pérdidas)."""
import argparse
import datetime as dt
import json
import platform
import time
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments, DataCollatorForSeq2Seq


def build(tok, max_len):
    def fn(ex):
        msgs = ex["messages"]
        prompt = tok.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True, enable_thinking=False)
        full = prompt + msgs[-1]["content"] + tok.eos_token
        p_ids = tok(prompt, add_special_tokens=False)["input_ids"]
        f_ids = tok(full, add_special_tokens=False)["input_ids"][:max_len]
        labels = [-100] * min(len(p_ids), len(f_ids)) + f_ids[len(p_ids):]   # pérdida solo en la respuesta del asistente
        return {"input_ids": f_ids, "attention_mask": [1] * len(f_ids), "labels": labels[:len(f_ids)]}
    return fn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--base", default="Qwen/Qwen3-1.7B")
    ap.add_argument("--out", default="out/quickcoti-lora")
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--r", type=int, default=16)
    ap.add_argument("--max_len", type=int, default=1536)
    ap.add_argument("--bs", type=int, default=4)
    ap.add_argument("--grad_acc", type=int, default=4)
    a = ap.parse_args()
    if not torch.cuda.is_available():
        raise SystemExit("❌ No hay GPU CUDA. Este entrenamiento debe correr en el servidor NVIDIA.")
    bf16 = torch.cuda.is_bf16_supported()
    log = {"inicio": dt.datetime.now().isoformat(timespec="seconds"), "host": platform.node(), "gpu": torch.cuda.get_device_name(0),
           "modelo_base": a.base, "licencia_base": "Apache-2.0 (Qwen3)", "parametros": vars(a), "precision": "bf16" if bf16 else "fp16"}
    tok = AutoTokenizer.from_pretrained(a.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(a.base, torch_dtype=torch.bfloat16 if bf16 else torch.float16, device_map={"": 0})
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(r=a.r, lora_alpha=2 * a.r, lora_dropout=0.05, task_type="CAUSAL_LM",
                                             target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    log["parametros_entrenables"] = trainable

    ds = load_dataset("json", data_files={"train": f"{a.data}/train.jsonl", "val": f"{a.data}/val.jsonl"})
    ds = ds.map(build(tok, a.max_len), remove_columns=ds["train"].column_names)
    args = TrainingArguments(output_dir=a.out + "_ckpt", num_train_epochs=a.epochs, learning_rate=a.lr,
                             per_device_train_batch_size=a.bs, per_device_eval_batch_size=a.bs, gradient_accumulation_steps=a.grad_acc,
                             lr_scheduler_type="cosine", warmup_ratio=0.05, logging_steps=5, eval_strategy="steps", eval_steps=25,
                             save_strategy="steps", save_steps=50, save_total_limit=2, bf16=bf16, fp16=not bf16,
                             report_to="none", seed=42)
    t0 = time.time()
    tr = Trainer(model=model, args=args, train_dataset=ds["train"], eval_dataset=ds["val"],
                 data_collator=DataCollatorForSeq2Seq(tok, padding=True, label_pad_token_id=-100))
    tr.train()
    log["duracion_min"] = round((time.time() - t0) / 60, 1)
    log["pasos"] = tr.state.global_step
    log["historial"] = tr.state.log_history
    log["eval_final"] = tr.evaluate()
    model.save_pretrained(a.out)
    tok.save_pretrained(a.out)
    log["fin"] = dt.datetime.now().isoformat(timespec="seconds")
    log["artefacto"] = a.out
    Path(a.out, "REGISTRO_LLM.json").write_text(json.dumps(log, indent=2, ensure_ascii=False, default=str))
    print(json.dumps({k: v for k, v in log.items() if k != "historial"}, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
