"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const sections = [
    {
      title: "Navigation & Selection",
      items: [
        { key: "j / ↓", desc: "Select next email thread" },
        { key: "k / ↑", desc: "Select previous email thread" },
        { key: "[  /  Ctrl+B", desc: "Toggle collapse extra-left sidebar" },
        { key: "/", desc: "Focus search bar" },
        { key: "Esc", desc: "Clear selection / close dialogs" },
      ],
    },
    {
      title: "Email Actions",
      items: [
        { key: "c", desc: "Compose new email" },
        { key: "r", desc: "Reply to selected thread" },
        { key: "e", desc: "Archive thread" },
        { key: "s", desc: "Toggle star / flag" },
        { key: "u", desc: "Toggle mark as unread" },
        { key: "h", desc: "Snooze thread until later" },
      ],
    },
    {
      title: "Power Tools & AI Copilot",
      items: [
        { key: "Cmd + K / Ctrl + K", desc: "Open Command Palette" },
        { key: "Cmd + J / Ctrl + J", desc: "Toggle AI Copilot Drawer" },
        { key: "z", desc: "Undo last sent email (during 5s grace window)" },
        { key: "?", desc: "Show this keyboard shortcuts guide" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Superhuman Shortcuts</DialogTitle>
              <p className="text-xs text-slate-400">Navigate and triage your inbox at speed</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {sec.title}
              </div>
              <div className="space-y-1.5">
                {sec.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-slate-800/50"
                  >
                    <span className="text-slate-300">{item.desc}</span>
                    <kbd className="font-mono text-[11px] text-blue-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/80 shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
