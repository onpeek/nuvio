import { z } from 'zod';

export type CommandRisk = 'read' | 'write' | 'destructive';

export interface Command {
  name: string;
  title: string;
  description: string;
  risk: CommandRisk;
  schema: z.ZodObject<z.ZodRawShape>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    if (this.commands.has(command.name)) throw new Error(`Duplicate command: ${command.name}`);
    this.commands.set(command.name, command);
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }
}
