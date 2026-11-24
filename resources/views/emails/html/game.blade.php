<x-mail::html.notification>
    <x-slot:body>
        {!! $formatter->convert($translator->trans('mrcaspan-flarum2-events-calendar.email.'.$blueprint->kind.'.body', $blueprint->emailParams() + [
            '{url}' => $url->to('forum')->route('discussion', ['id' => $blueprint->discussion->id]),
        ])) !!}
    </x-slot:body>
</x-mail::html.notification>
