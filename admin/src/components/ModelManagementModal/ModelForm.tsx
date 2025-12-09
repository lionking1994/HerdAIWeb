import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Loader2 } from "lucide-react";

const modelSchema = z.object({
  id: z.number().optional(), 
  name: z.string().min(1, "Name is required"),
  model: z.string().min(1, "Model is required"),
});

type ModelFormData = z.infer<typeof modelSchema>;

interface ModelFormProps {
  model?: ModelFormData | null;
  onSubmit: (data: ModelFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function ModelForm({
  model,
  onSubmit,
  onCancel,
  isLoading,
}: ModelFormProps) {
  const form = useForm<ModelFormData>({
    resolver: zodResolver(modelSchema),
    defaultValues: model || {
      id: undefined,
      name: "",
      model: "",
    },
  });
console.log(model);
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} type="hidden" />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {model ? "Update" : "Add"} Model
          </Button>
        </div>
      </form>
    </Form>
  );
}
