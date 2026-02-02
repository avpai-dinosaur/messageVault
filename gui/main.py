import tkinter as tk
import tkinter.font as tkfont
from tkinter import ttk, messagebox
from tkcalendar import DateEntry
from datetime import datetime, timezone
from pathlib import Path
import re


DATE_ENTRY_DATE_FORMAT = "%Y-%m-%d"


class Message:
    """Class representing a message."""

    def __init__(self, prisoner: str, message_type: str, datetime: datetime, content: str):
        """Constructor."""
        self.prisoner = prisoner
        self.message_type = message_type
        self.datetime = datetime
        self.content = content


class MyDateEntry(DateEntry):
    """Subclass of DateEntry to enforce date format."""

    def _on_focus_out_cal(self, event):
        """Better focus-out handler: keep calendar open during internal navigation,
        but close when clicking outside the calendar entirely."""
        
        mouse_x, mouse_y = self._top_cal.winfo_pointerxy()

        x0 = self._top_cal.winfo_rootx()
        y0 = self._top_cal.winfo_rooty()
        x1 = x0 + self._top_cal.winfo_width()
        y1 = y0 + self._top_cal.winfo_height()

        inside = (x0 <= mouse_x <= x1) and (y0 <= mouse_y <= y1)

        if inside:
            try:
                self._calendar.focus_force()
            except Exception:
                pass
        else:
            self._top_cal.withdraw()
            self.state(['!pressed', '!active'])


def parse_datetime_from_filename(filename: str) -> datetime | None:
    """Parses the UTC datetime from a given filename and returns a datetime object in the user's local timezone.

    The expected file format is YYYY-MM-DD_HH-MM-SS_<hash>.txt. 
    
    Returns:
        A datetime object in the user's local timezone or None if parsing fails.
    """
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})", filename)
    if match is None:
        return None
    year, month, day, hour, minute, second = map(int, match.groups())
    utc_dt = datetime(int(year), int(month), int(day), int(hour), int(minute), int(second), tzinfo=timezone.utc)
    local_dt = utc_dt.astimezone() 
    return local_dt


def load_messages() -> list[Message]:
    """Scans the MessageVault directory and returns a list of Message objects.

    Directory format:
    /Users/<user>/Documents/MessageVault/<prisoner>/<sent|received>/<year>/<month>/<file>.txt
    """
    messages = []
    documents_dir = Path.home() / "Documents" / "MessageVault"
    if not documents_dir.exists():
        return messages

    for prisoner_dir in documents_dir.iterdir():
        if not prisoner_dir.is_dir():
            continue
        for message_type_dir in prisoner_dir.iterdir():
            if message_type_dir.name not in ("sent", "received"):
                continue
            for year_dir in message_type_dir.iterdir():
                if not year_dir.name.isdigit():
                    continue
                for month_dir in year_dir.iterdir():
                    if not month_dir.name.isdigit():
                        continue
                    for message_file in month_dir.iterdir():
                        if message_file.suffix != ".txt":
                            continue
                        try:
                            message_datetime = parse_datetime_from_filename(message_file.stem)
                            if message_datetime is None:
                                raise ValueError(f"Invalid filename format: {message_file.name}")
                            with open(message_file, "r", encoding="utf-8") as f:
                                content = f.read()
                            messages.append(
                                Message(
                                    prisoner=prisoner_dir.name,
                                    message_type=message_type_dir.name,
                                    datetime=message_datetime,
                                    content=content
                                )
                            )
                        except Exception as e:
                            print(f"Error reading {message_file}: {e}")
    return messages


def filter_messages(messages: list[Message], start_date: DateEntry, end_date: DateEntry, search_var: tk.StringVar, type_var: tk.StringVar) -> list[Message]:
    """Filter messages based on date range and topic keyword.
    
    Returns:
        A list of Message objects that match the filters. 
    """
    start = start_date.get_date()
    end = end_date.get_date()
    keyword = search_var.get().lower()
    message_type = type_var.get().lower()

    filtered = []
    for m in messages:
        if start <= m.datetime.date() <= end:
            if not keyword or keyword in m.content.lower():
                if message_type == "all" or m.message_type == message_type:
                    filtered.append(m)

    return filtered


def update_table(messages: list[Message], table: ttk.Treeview):
    """Update the Treeview table with a list of messages to be displayed."""
    for row in table.get_children():
        table.delete(row)

    for idx, message in enumerate(messages):
        snippet = message.content[:50].replace("\n", " ") + ("..." if len(message.content) > 50 else "")
        table.insert("", "end", iid=idx, values=(message.datetime.strftime(DATE_ENTRY_DATE_FORMAT), message.message_type, "", snippet))


def on_search_button_click(
        messages: list[Message],
        table: ttk.Treeview,
        start_date: DateEntry,
        end_date: DateEntry,
        search_var: tk.StringVar,
        type_var: tk.StringVar
    ):
    """Handle search button click to filter messages and update the table."""
    filtered = filter_messages(messages, start_date, end_date, search_var, type_var) 
    update_table(filtered, table)


def on_row_click(
        event,
        messages: list[Message],
        table: ttk.Treeview,
        start_date: DateEntry,
        end_date: DateEntry,
        search_var: tk.StringVar,
        type_var: tk.StringVar,
        viewer: tk.Text
    ):
    """Show full message content when a row is clicked."""
    selected = table.selection()
    if not selected:
        return

    idx = int(selected[0])
    filtered = filter_messages(messages, start_date, end_date, search_var, type_var)
    if idx >= len(filtered):
        return

    msg = filtered[idx]

    viewer.config(state='normal')
    viewer.delete("1.0", tk.END)
    viewer.insert(
        tk.END,
        f"Prisoner: {msg.prisoner}\n"
        f"Type: {msg.message_type}\n"
        f"Date: {msg.datetime}\n\n"
        f"{msg.content}"
    )
    viewer.configure(state='disabled')

if __name__ == "__main__":
    messages = load_messages()
    messages.sort(key=lambda m: m.datetime, reverse=True)

    root = tk.Tk()
    root.title("MessageVault")

    # Filters frame
    filter_frame = ttk.Frame(root)
    filter_frame.pack(padx=10, pady=10, fill='x')

    ttk.Label(filter_frame, text="Start Date:").pack(side='left')
    start_date = MyDateEntry(filter_frame, width=12, state='normal', date_pattern='yyy-MM-dd')
    start_date.pack(side='left', padx=5)
    start_date.set_date(messages[-1].datetime.date() if messages else datetime.now().date())

    ttk.Label(filter_frame, text="End Date:").pack(side='left')
    end_date = MyDateEntry(filter_frame, width=12, state='normal', date_pattern='yyy-MM-dd')
    end_date.pack(side='left', padx=5)
    end_date.set_date(datetime.now().date())

    ttk.Label(filter_frame, text="Type:").pack(side='left')
    type_var = tk.StringVar(value="all")
    type_options = ["all", "sent", "received"]
    type_menu = ttk.Combobox(filter_frame, textvariable=type_var, values=type_options, state="readonly")
    type_menu.pack(side='left', padx=5)

    ttk.Label(filter_frame, text="Topic:").pack(side='left', padx=(10,0))
    search_var = tk.StringVar()
    search_entry = ttk.Entry(filter_frame, textvariable=search_var, width=20)
    search_entry.pack(side='left', padx=5)

    search_button = ttk.Button(filter_frame, text="Filter", command=lambda: on_search_button_click(messages, table, start_date, end_date, search_var, type_var))
    search_button.pack(side='left', padx=5)

    # Split main window into two sections
    paned = ttk.PanedWindow(root, orient='vertical')
    paned.pack(fill='both', expand=True)

    # Table frame
    table_frame = ttk.Frame(paned)
    paned.add(table_frame, weight=1)

    columns = ("Date", "Type", "Topic", "Message")
    table = ttk.Treeview(table_frame, columns=columns, show='headings')
    for col in columns:
        table.heading(col, text=col)
        table.column(col, anchor='w')

    # Scrollbar for treeview
    table_scroll = ttk.Scrollbar(table_frame, orient="vertical", command=table.yview)
    table.configure(yscrollcommand=table_scroll.set)
    table_scroll.pack(side='right', fill='y')

    table.pack(side="left", fill="both", expand=True)
    table_scroll.pack(side="right", fill="y")

    table_frame.rowconfigure(0, weight=1)
    table_frame.columnconfigure(0, weight=1)

    # Full message viewer
    viewer_frame = ttk.Frame(paned)
    paned.add(viewer_frame, weight=1)

    message_view = tk.Text(viewer_frame, wrap="word")
    viewer_scroll = ttk.Scrollbar(viewer_frame, orient="vertical", command=message_view.yview)
    message_view.configure(yscrollcommand=viewer_scroll.set, font=tkfont.Font(family="Arial", size=12))

    message_view.grid(row=0, column=0, sticky="nsew")
    viewer_scroll.grid(row=0, column=1, sticky="ns")

    viewer_frame.rowconfigure(0, weight=1)
    viewer_frame.columnconfigure(0, weight=1)

    # Initial message in viewer
    message_view.insert(
        tk.END,
        "Double-click a message in the table to view its full content here."
    )
    message_view.configure(state='disabled')

    # Bind row click
    table.bind("<Double-1>", lambda event: on_row_click(event, messages, table, start_date, end_date, search_var, type_var, message_view))

    # Populate initial table
    update_table(messages, table)

    root.mainloop()
