<template>
  <div>
    <router-link :to="'/' + movie.decade + '#' + movie.tconst" class="movie-container">
      <div class="movie-title"><span>{{ ellipsis(movie.title, 40) }}</span></div>
      <div v-if="movie.posterUrl" class="poster">
        <v-img :src="movie.posterUrl" width="70" height="100" aspect-ratio="1" />
      </div>
    </router-link>
    <div v-if="!hideTimestamp" class="movie-timestamp">
      <TimestampLink :movie="movie" :episode="episode" :showTimestamp="true"></TimestampLink>
    </div>
  </div>
</template>

<script src="./MoviePoster.ts" lang="ts"></script>

<style lang="scss" scoped>
.movie-container {
  display: inline-block;
  width: 110px;
  text-align: center;
  margin-bottom: 10px;
}

.poster {
  display: inline-block;
  height: 110px;
  padding: 5px;
  box-sizing: border-box;
  overflow: hidden;
}

.movie-title {
  display: flex;
  line-height: 110%;
  font-size: 95%;
  width: 110px;
  height: 50px;
  vertical-align: bottom;
  align-items: flex-end;
  justify-content: center;
  padding: 5px;
}

.movie-timestamp {
  text-align: center;
  color: #AAA;
}
</style>