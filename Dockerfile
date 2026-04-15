FROM ubuntu:25.10

ENV work_dir=/opt/server

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       locales tzdata \
       curl ca-certificates \
       nodejs npm \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p ${work_dir}

COPY . ${work_dir}/
WORKDIR ${work_dir}/
RUN npm install

EXPOSE 9000 9001
ENTRYPOINT [ "./docker-entrypoint.sh" ]
